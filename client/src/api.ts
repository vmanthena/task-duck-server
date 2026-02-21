import { $ } from './utils.js';
import { state } from './state.js';
import { renderProviders } from './auth.js';
import { API_PATHS, STORAGE_KEYS } from '../../shared/constants.js';

export async function checkAuth(): Promise<void> {
  // If we have a saved token, validate it
  if (state.authToken) {
    try {
      const r = await fetch(API_PATHS.providers, { headers: { 'Authorization': `Bearer ${state.authToken}` } });
      if (r.ok) {
        $('loginOverlay').classList.add('hidden');
        await loadProviders();
        return;
      }
      state.authToken = '';
      localStorage.removeItem(STORAGE_KEYS.token);
    } catch { /* token invalid, show login */ }
  }
  // Try auto-login (succeeds when server has no PASSWORD_VERIFIER)
  try {
    const r = await fetch(API_PATHS.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (r.ok) {
      const d = await r.json();
      state.authToken = d.token;
      localStorage.setItem(STORAGE_KEYS.token, state.authToken);
      $('loginOverlay').classList.add('hidden');
      await loadProviders();
    }
  } catch { /* auto-login not available */ }
}

export async function loadProviders(): Promise<void> {
  try {
    const r = await fetch(API_PATHS.providers, { headers: { 'Authorization': `Bearer ${state.authToken}` } });
    const d = await r.json();
    state.availableProviders = d.providers || [];
    renderProviders();
  } catch { console.warn('Failed to load providers'); }
}
