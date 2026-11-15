// Normal settings (theme, bot name, search history). No secrets are stored by the app.
export const prefs = {
  get(key, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
  getJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
};
