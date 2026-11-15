// Talks to your bot through Telegram Web (web.telegram.org/k) held in a hidden native WebView.
// No API keys needed. You log in once inside that page. The page selectors below can break if Telegram changes its site.
import { registerPlugin } from '@capacitor/core';
const TgWeb = registerPlugin('TgWeb');

let status = 'loggedout', onStatus = () => {};
export const setStatusListener = fn => { onStatus = fn; };
export const getStatus = () => status;
const setStatus = s => { status = s; onStatus(s); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
export const validBot = n => /^[A-Za-z][A-Za-z0-9_]{2,30}bot$/i.test(n);

export function friendly(e) {
  const m = String(e?.message || e);
  const map = {
    TIMEOUT: 'The bot did not answer in time. Try again.',
    OFFLINE: 'Not connected to Telegram.',
    NO_INPUT: 'Cannot find the Telegram message box. Open Settings > Test Telegram page.',
    SEND_FAILED: 'The message was not sent. Open Settings > Test Telegram page.',
    'not implemented': 'This works only inside the Android app.'
  };
  for (const k in map) if (m.includes(k)) return map[k];
  if (/not ready/i.test(m)) return 'Telegram page is still loading. Wait and try again.';
  return 'Something went wrong: ' + m.slice(0, 120);
}

/* ---- functions that run INSIDE the Telegram page (they must not use outside variables) ---- */
const pageState = () => {
  if (document.querySelector('.chatlist-container, .chatlist-chat, #column-left .chatlist')) return 'in';
  if (document.querySelector('#auth-pages, .page-sign, .page-signQR, .qr-container, .input-field-phone')) return 'auth';
  return 'loading';
};
const pageOpenBot = bot => {
  const h = '#@' + bot;
  if (location.hash.toLowerCase() === h.toLowerCase()) return 'same';
  location.hash = h; return 'changed';
};
const pageReady = () => {
  if (document.querySelector('.input-message-input[contenteditable]')) return 'ready';
  const st = [...document.querySelectorAll('button')].find(b => /^\s*start\s*$/i.test(b.textContent) && b.offsetParent);
  if (st) { st.click(); return 'started'; }
  return 'wait';
};
const pageMaxMid = () => Math.max(0, ...[...document.querySelectorAll('.bubble[data-mid]')].map(b => Number(b.dataset.mid) || 0));
const pageInputLen = () => (document.querySelector('.input-message-input[contenteditable]')?.textContent || '').trim().length;
const pageSend = text => {
  const el = document.querySelector('.input-message-input[contenteditable]'); if (!el) return false;
  el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, text);
  const btn = document.querySelector('.btn-send');
  if (btn) btn.click(); else el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  return true;
};
const pageRead = (minMid, skipPoster) => {
  const out = [];
  document.querySelectorAll('.bubble[data-mid]').forEach(b => {
    if (!b.classList.contains('is-in')) return;
    const mid = Number(b.dataset.mid); if (!(mid > minMid)) return;
    let text = '', links = [];
    const msg = b.querySelector('.message');
    if (msg) {
      const c = msg.cloneNode(true);
      c.querySelectorAll('.time,.reactions,.reply-markup').forEach(x => x.remove());
      c.querySelectorAll('br').forEach(x => x.replaceWith('\n'));
      text = (c.textContent || '').trim();
      msg.querySelectorAll('a[href]').forEach(a => links.push({ url: a.href, label: (a.textContent || '').trim() }));
    }
    const buttons = [];
    b.querySelectorAll('.reply-markup-button').forEach((btn, i) => {
      const t = (btn.textContent || '').trim();
      if (btn.href) links.push({ url: btn.href, label: t }); else buttons.push({ text: t, i });
    });
    let poster = null; const im = b.querySelector('img.media-photo');
    if (im && im.complete && im.naturalWidth && !skipPoster.includes(mid)) {
      try { const w = Math.min(480, im.naturalWidth), h = Math.round(im.naturalHeight * w / im.naturalWidth), cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0, w, h); poster = cv.toDataURL('image/jpeg', 0.7); } catch (e) { /* ignore */ }
    }
    out.push({ mid, text, links, buttons, poster, hasFile: !!b.querySelector('.document,.audio,video,.media-video') });
  });
  return out;
};
const pagePress = (mid, i) => {
  const b = document.querySelector('.bubble[data-mid="' + mid + '"]'); const btn = b && b.querySelectorAll('.reply-markup-button')[i];
  if (!btn) return false; btn.click(); return true;
};
const pageDiagnose = () => {
  const bs = [...document.querySelectorAll('.bubble[data-mid]')]; const last = bs[bs.length - 1];
  return { url: location.href, bubbles: bs.length, incoming: bs.filter(b => b.classList.contains('is-in')).length,
    hasInput: !!document.querySelector('.input-message-input[contenteditable]'), hasSend: !!document.querySelector('.btn-send'),
    loggedIn: !!document.querySelector('.chatlist-container, .chatlist-chat'), authScreen: !!document.querySelector('#auth-pages, .page-sign, .qr-container'),
    lastBubble: last ? last.outerHTML.replace(/\s+/g, ' ').slice(0, 1800) : null };
};

async function run(fn, ...args) {
  const r = await TgWeb.evaluate({ script: `JSON.stringify((${fn.toString()})(...${JSON.stringify(args)}))` });
  const v = JSON.parse(r.value ?? 'null'); return v == null ? null : JSON.parse(v);
}

/* ---- public API ---- */
export async function start() {
  setStatus('connecting');
  try {
    await TgWeb.open();
    for (let i = 0; i < 30; i++) {
      const s = await run(pageState).catch(() => 'loading');
      if (s === 'in') { setStatus('connected'); return true; }
      if (s === 'auth') { setStatus('loggedout'); return false; }
      await sleep(1000);
    }
    throw new Error('TIMEOUT');
  } catch (e) { setStatus('error'); throw e; }
}
export const showTelegram = () => TgWeb.show();
export const hideTelegram = () => TgWeb.hide();
export const onDone = cb => TgWeb.addListener('done', cb);
export const diagnose = () => run(pageDiagnose);
export async function logout() { try { await TgWeb.clear(); } catch { /* ignore */ } setStatus('loggedout'); }

async function ensureBot(bot) {
  if ((await run(pageOpenBot, bot)) === 'changed') await sleep(1800);
  for (let i = 0; i < 20; i++) {
    const r = await run(pageReady).catch(() => 'wait');
    if (r === 'ready') return;
    await sleep(r === 'started' ? 1500 : 700);
  }
  throw new Error('NO_INPUT');
}

const cleanLinks = l => { const seen = new Set(); return l.filter(x => { try { const u = new URL(x.url); if (!/^https?:$/.test(u.protocol) || u.hostname.endsWith('telegram.org') || seen.has(x.url)) return false; seen.add(x.url); return true; } catch { return false; } })
  .map(x => ({ url: x.url, label: x.label === x.url ? '' : x.label })); };

export async function search(bot, text, onMessages, opts) {
  if (status !== 'connected') throw new Error('OFFLINE');
  await ensureBot(bot);
  const base = await run(pageMaxMid);
  if (!(await run(pageSend, text))) throw new Error('NO_INPUT');
  await sleep(700);
  if ((await run(pageInputLen)) > 0) throw new Error('SEND_FAILED');
  return collect(base, onMessages, opts);
}

export async function pressButton(bot, mid, i, onMessages) {
  await ensureBot(bot);
  if (!(await run(pagePress, mid, i))) throw new Error('NO_INPUT');
  return collect(mid - 1, onMessages, { firstTimeout: 20000, quiet: 6000 });
}

async function collect(base, onMessages, { firstTimeout = 45000, quiet = 9000, signal } = {}) {
  const seen = new Map(), posters = new Map(), start = Date.now(); let last = Date.now();
  for (;;) {
    if (signal?.aborted) return;
    await sleep(1500);
    const list = (await run(pageRead, base, [...posters.keys()])) || [];
    let changed = false;
    for (const m of list) {
      if (m.poster) posters.set(m.mid, m.poster); else if (posters.has(m.mid)) m.poster = posters.get(m.mid);
      const s = [m.mid, m.text.length, m.links.length, m.buttons.length, !!m.poster].join('|');
      if (seen.get(m.mid) !== s) { seen.set(m.mid, s); changed = true; }
    }
    if (changed) { last = Date.now(); onMessages(list.map(m => ({ id: m.mid, text: m.text, links: cleanLinks(m.links), buttons: m.buttons, poster: m.poster, hasFile: m.hasFile }))); }
    if (!seen.size && Date.now() - start > firstTimeout) throw new Error('TIMEOUT');
    if (seen.size && Date.now() - last > quiet) return;
  }
}
