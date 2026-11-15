import './style.css';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Network } from '@capacitor/network';
import { prefs } from './prefs.js';
import * as tg from './tg.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { connected: 'Connected', connecting: 'Connecting…', loggedout: 'Not connected', error: 'Connection problem', offline: 'Offline' };
let online = true, bot = prefs.get('rf_bot'), history = prefs.getJSON('rf_history', []), busy = false;

/* ---------- small helpers ---------- */
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 3200); }
function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === id));
}
const open = id => { $(id).hidden = false; }, close = id => { $(id).hidden = true; };

function applyTheme() {
  const t = prefs.get('rf_theme', 'dark');
  const real = t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  document.documentElement.dataset.theme = real;
  document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
}
function renderStatus() {
  const s = online ? tg.getStatus() : 'offline';
  $('statusChip').dataset.s = s; $('statusText').textContent = STATUS[s]; $('setStatus').textContent = STATUS[s] + (bot ? ` · @${bot}` : '');
  $('offline').hidden = online;
}
function renderRecent() {
  $('recent').innerHTML = history.map(h => `<button data-q="${esc(h)}">${esc(h)}</button>`).join('');
  $('recentEmpty').hidden = history.length > 0;
}
tg.setStatusListener(renderStatus);

/* ---------- search + results ---------- */
function threadEmpty() { $('thread').innerHTML = '<div class="empty"><b>No results yet</b>Search for a movie to see what your bot sends back.</div>'; }
function cardHTML(m, i) {
  const lines = m.text.split('\n').map(s => s.replace(/https?:\/\/\S+/g, '').replace(/[*_`]/g, '').trim()).filter(Boolean);
  const title = lines.shift() || (m.hasFile ? 'File from the bot' : 'Reply');
  const body = lines.join('\n');
  const links = m.links.map((l, k) => { let h = ''; try { h = new URL(l.url).hostname.replace(/^www\./, ''); } catch {} return `<button class="lk" data-url="${esc(l.url)}"><span>${esc(l.label || 'Open link ' + (k + 1))}</span><small>${esc(h)}</small></button>`; }).join('');
  const cbs = m.buttons.map((b, k) => `<button class="cb" data-mid="${m.id}" data-k="${b.i}">${esc(b.text)}</button>`).join('');
  return `<article class="card" data-id="${m.id}" style="--i:${i}">${m.poster ? `<img alt="" src="${esc(m.poster)}">` : ''}<div class="in"><h4>${esc(title)}</h4>${body ? `<p>${esc(body)}</p>` : ''}${m.hasFile && !m.text ? '<p>This app cannot open files yet.</p>' : ''}${links ? `<div class="links">${links}</div>` : ''}${cbs ? `<div class="row">${cbs}</div>` : ''}</div></article>`;
}
const buttonStore = new Map();
function paint(box, msgs) {
  box.innerHTML = msgs.map(cardHTML).join('');
  msgs.forEach(m => buttonStore.set(m.id, m.buttons));
}

async function runSearch(text) {
  text = text.trim().replace(/\s+/g, ' ');
  if (!text || busy) return;
  if (!bot) { toast('Set your bot username in Settings.'); show('v-settings'); return; }
  if (!online) { toast('You are offline.'); return; }
  if (tg.getStatus() !== 'connected') { toast('Not connected to Telegram.'); if (tg.getStatus() === 'loggedout') open('login'); return; }
  busy = true;
  history = [text, ...history.filter(h => h.toLowerCase() !== text.toLowerCase())].slice(0, 12);
  prefs.set('rf_history', JSON.stringify(history)); renderRecent();
  $('homeQ').value = $('chatQ').value = ''; show('v-chat');
  const th = $('thread'); th.querySelector('.empty')?.remove();
  const q = document.createElement('div'); q.className = 'q'; q.textContent = text;
  const res = document.createElement('div'); res.className = 'stack'; res.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  th.append(q, res); th.parentElement.scrollTop = th.parentElement.scrollHeight;
  try {
    await tg.search(bot, text, msgs => { paint(res, msgs); });
    if (!res.querySelector('.card')) res.innerHTML = '<div class="empty"><b>No answer</b>The bot sent nothing back.</div>';
  } catch (e) {
    const had = res.querySelector('.card');
    if (!had) res.innerHTML = '';
    res.insertAdjacentHTML('beforeend', `<div class="block"><p class="err">${esc(tg.friendly(e))}</p><button class="btn" data-retry="${esc(text)}">Try again</button></div>`);
  }
  busy = false; th.parentElement.scrollTop = th.parentElement.scrollHeight;
}

/* ---------- login (Telegram Web) ---------- */
let tgVisible = false;
async function afterDone() {
  tgVisible = false;
  try {
    if (await tg.start()) { close('login'); toast('Connected to Telegram.'); } else { $('loginErr').textContent = 'Not logged in yet. Press the button and log in.'; open('login'); }
  } catch (e) { $('loginErr').textContent = tg.friendly(e); }
  $('loginBtn').disabled = false;
}
async function loginNext() {
  const b = $('loginBot').value.trim().replace(/^@/, ''), err = m => { $('loginErr').textContent = m; };
  err('');
  if (!tg.validBot(b)) return err('Bot username must end with "bot".');
  if (!online) return err('You are offline.');
  bot = b; prefs.set('rf_bot', b); $('botInput').value = b; renderStatus();
  try { tgVisible = true; await tg.showTelegram(); } catch (e) { tgVisible = false; err(tg.friendly(e)); }
}

/* ---------- start-up ---------- */
async function connectSaved() {
  try { if (!(await tg.start())) { $('loginBot').value = bot; open('login'); } }
  catch (e) { toast(tg.friendly(e)); }
}
async function logoutNow() { await tg.logout(); $('loginBot').value = bot; open('login'); renderStatus(); }

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.url) Browser.open({ url: t.dataset.url }).catch(() => toast('Cannot open this link.'));
  else if (t.dataset.q) runSearch(t.dataset.q);
  else if (t.dataset.retry) { t.closest('.block').remove(); runSearch(t.dataset.retry); }
  else if (t.dataset.mid) {
    const id = Number(t.dataset.mid), k = Number(t.dataset.k); if (busy) return;
    busy = true; t.disabled = true; const box = t.closest('.stack');
    try { await tg.pressButton(bot, id, k, msgs => paint(box, msgs)); } catch (er) { toast(tg.friendly(er)); }
    busy = false;
  }
});
$('tabs').onclick = e => { const b = e.target.closest('button'); if (b) show(b.dataset.v); };
$('statusChip').onclick = () => { if (tg.getStatus() === 'loggedout') open('login'); else if (['error'].includes(tg.getStatus())) connectSaved(); };
$('homeForm').onsubmit = e => { e.preventDefault(); runSearch($('homeQ').value); };
$('chatForm').onsubmit = e => { e.preventDefault(); runSearch($('chatQ').value); };
$('newSearch').onclick = () => { show('v-home'); $('homeQ').focus(); };
$('consentOk').onclick = () => { prefs.set('rf_ack', '1'); close('consent'); connectSaved(); };
$('loginBtn').onclick = loginNext;
$('showTg').onclick = async () => { tgVisible = true; try { await tg.showTelegram(); } catch (e) { tgVisible = false; toast(tg.friendly(e)); } };
$('testTg').onclick = async () => { const d = $('diag'); d.hidden = false; $('copyDiag').hidden = false; d.textContent = 'Testing…'; try { d.textContent = JSON.stringify(await tg.diagnose(), null, 1); } catch (e) { d.textContent = tg.friendly(e); } };
$('copyDiag').onclick = () => navigator.clipboard?.writeText($('diag').textContent).then(() => toast('Copied.'), () => toast('Cannot copy.'));
$('reconnect').onclick = connectSaved;
$('logout').onclick = () => { if (confirm('Log out and delete the saved Telegram session?')) logoutNow(); };
$('clearHistory').onclick = () => { history = []; prefs.set('rf_history', '[]'); renderRecent(); threadEmpty(); toast('History cleared.'); };
$('themeSeg').onclick = e => { const b = e.target.closest('button'); if (b) { prefs.set('rf_theme', b.dataset.t); applyTheme(); } };
$('saveBot').onclick = () => {
  const b = $('botInput').value.trim().replace(/^@/, ''), er = $('botErr'); er.textContent = '';
  if (!tg.validBot(b)) { er.textContent = 'Bot username must end with "bot".'; return; }
  bot = b; prefs.set('rf_bot', b); renderStatus(); toast('Bot saved.');
};
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme);
CapApp.addListener('backButton', () => {
  if (tgVisible) { tgVisible = false; tg.hideTelegram(); return; }
  if ($('v-home').classList.contains('on')) CapApp.exitApp(); else show('v-home');
});
Network.addListener('networkStatusChange', s => { const was = online; online = s.connected; renderStatus(); if (online && !was && tg.getStatus() !== 'loggedout') connectSaved(); });

(async function init() {
  applyTheme(); renderRecent(); threadEmpty(); $('botInput').value = bot; tg.onDone(afterDone);
  try { online = (await Network.getStatus()).connected; } catch { online = navigator.onLine; }
  renderStatus();
  if (prefs.get('rf_ack') !== '1') open('consent'); else connectSaved();
})();
