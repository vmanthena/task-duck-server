import { $ } from './utils.js';
import { state } from './state.js';
import { renderProviders } from './auth.js';

export async function checkAuth(): Promise<void> {
  // If we have a saved token, validate it
  if (state.authToken) {
    try {
      const r = await fetch('/api/providers', { headers: { 'Authorization': `Bearer ${state.authToken}` } });
      if (r.ok) {
        $('loginOverlay').classList.add('hidden');
        await loadProviders();
        return;
      }
      state.authToken = '';
      localStorage.removeItem('tdToken');
    } catch {}
  }
  // Try auto-login (succeeds when server has no PASSWORD_VERIFIER)
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (r.ok) {
      const d = await r.json();
      state.authToken = d.token;
      localStorage.setItem('tdToken', state.authToken);
      $('loginOverlay').classList.add('hidden');
      await loadProviders();
    }
  } catch {}
}

export async function loadProviders(): Promise<void> {
  try {
    const r = await fetch('/api/providers', { headers: { 'Authorization': `Bearer ${state.authToken}` } });
    const d = await r.json();
    state.availableProviders = d.providers || [];
    renderProviders();
  } catch {}
}
