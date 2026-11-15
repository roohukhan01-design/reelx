package com.reelfinder.app;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Holds one Telegram Web page in a WebView that is hidden off-screen.
 * show() puts it on top so you can log in. evaluate() runs a script, but only on telegram.org pages.
 * No JavaScript interface is added to the page.
 */
@CapacitorPlugin(name = "TgWeb")
public class TgWebPlugin extends Plugin {
    private static final String BASE = "https://web.telegram.org/k/";
    private LinearLayout box;
    private WebView web;

    private boolean onTelegram() {
        if (web == null || web.getUrl() == null) return false;
        String host = Uri.parse(web.getUrl()).getHost();
        return host != null && (host.equals("telegram.org") || host.endsWith(".telegram.org"));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void build() {
        web = new WebView(getActivity());
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String host = r.getUrl().getHost();
                boolean ok = host != null && (host.equals("telegram.org") || host.endsWith(".telegram.org"));
                return !ok; // block everything that is not telegram.org
            }
        });
        Button done = new Button(getActivity());
        done.setText("Done");
        done.setOnClickListener(v -> {
            hideBox();
            notifyListeners("done", new JSObject());
        });
        box = new LinearLayout(getActivity());
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackgroundColor(Color.parseColor("#0F2A33"));
        box.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        box.addView(done, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));
        getActivity().addContentView(box, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        hideBox();
    }

    // Hidden = pushed far off-screen but still laid out, so the page keeps working.
    private void hideBox() { box.setTranslationX(-20000f); box.setVisibility(View.VISIBLE); }

    @PluginMethod
    public void open(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (web == null) build();
            if (web.getUrl() == null) web.loadUrl(BASE);
            call.resolve();
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (web == null) build();
            if (web.getUrl() == null) web.loadUrl(BASE);
            box.setTranslationX(0f);
            box.bringToFront();
            call.resolve();
        });
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> { if (box != null) hideBox(); call.resolve(); });
    }

    @PluginMethod
    public void evaluate(PluginCall call) {
        final String script = call.getString("script");
        if (script == null) { call.reject("No script"); return; }
        getActivity().runOnUiThread(() -> {
            if (!onTelegram()) { call.reject("Telegram page is not ready"); return; }
            web.evaluateJavascript(script, value -> {
                JSObject r = new JSObject();
                r.put("value", value);
                call.resolve(r);
            });
        });
    }

    @PluginMethod
    public void clear(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            CookieManager.getInstance().removeAllCookies(null);
            CookieManager.getInstance().flush();
            WebStorage.getInstance().deleteAllData();
            if (web != null) { web.clearCache(true); web.loadUrl(BASE); }
            call.resolve();
        });
    }
}
