// Runs after "npx cap add android". Adds icons, splash, and safer manifest settings.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const main = path.join(root, 'android/app/src/main');
const res = path.join(main, 'res');
if (!fs.existsSync(main)) { console.error('::error::android/ folder not found. Run "npx cap add android" first.'); process.exit(1); }

// 1) Remove template splash images (we use drawable/splash.xml instead, so no duplicate names).
for (const dir of fs.readdirSync(res)) {
  if (!dir.startsWith('drawable')) continue;
  for (const f of fs.readdirSync(path.join(res, dir))) {
    if (/^splash\.(png|jpg|webp|xml)$/.test(f)) fs.rmSync(path.join(res, dir, f));
  }
}
// 2) Copy our icons, splash and colors over the template.
fs.cpSync(path.join(root, 'android-overlay/res'), res, { recursive: true });

// 2b) Native plugin that holds the hidden Telegram Web page.
const javaDest = path.join(main, 'java/com/reelfinder/app');
fs.mkdirSync(javaDest, { recursive: true });
fs.cpSync(path.join(root, 'android-overlay/java/com/reelfinder/app'), javaDest, { recursive: true });

// 3) Manifest: no backups of app data, no plain-http traffic, keyboard resizes the page.
const mf = path.join(main, 'AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
x = x.replace(/android:allowBackup="[^"]*"/, 'android:allowBackup="false"');
if (!x.includes('usesCleartextTraffic')) x = x.replace('<application', '<application android:usesCleartextTraffic="false"');
if (!x.includes('windowSoftInputMode')) x = x.replace('<activity', '<activity android:windowSoftInputMode="adjustResize"');
fs.writeFileSync(mf, x);

// 4) App name
const sf = path.join(res, 'values/strings.xml');
if (fs.existsSync(sf)) {
  let s = fs.readFileSync(sf, 'utf8');
  s = s.replace(/(<string name="app_name">)[^<]*/, '$1Reelfinder').replace(/(<string name="title_activity_main">)[^<]*/, '$1Reelfinder');
  fs.writeFileSync(sf, s);
}

// 5) Android 12+ splash background color (only if the template uses Theme.SplashScreen)
const st = path.join(res, 'values/styles.xml');
if (fs.existsSync(st)) {
  let t = fs.readFileSync(st, 'utf8');
  if (t.includes('Theme.SplashScreen') && !t.includes('windowSplashScreenBackground')) {
    t = t.replace(/(<style name="AppTheme.NoActionBarLaunch"[^>]*>)/, '$1\n        <item name="windowSplashScreenBackground">@color/reel_bg</item>');
    fs.writeFileSync(st, t);
  }
}
console.log('Android project prepared.');
