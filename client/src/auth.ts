import bcrypt from 'bcryptjs';
import { $, formatTime } from './utils.js';
import { state } from './state.js';
import { playQuack } from './sound.js';
import { loadProviders } from './api.js';
import { API_PATHS, STORAGE_KEYS, BCRYPT } from '../../shared/constants.js';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function togglePasswordVis(): void {
  const passwordInput = $('loginPassword') as HTMLInputElement;
  const eyeShow = $('pwEyeShow'), eyeHide = $('pwEyeHide');
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text'; eyeShow.style.display = 'none'; eyeHide.style.display = 'block';
  } else {
    passwordInput.type = 'password'; eyeShow.style.display = 'block'; eyeHide.style.display = 'none';
  }
  passwordInput.focus();
}

export function startLockoutCountdown(sec: number): void {
  state.clientLockoutUntil = Date.now() + (sec * 1000);
  localStorage.setItem(STORAGE_KEYS.lockout, String(state.clientLockoutUntil));
  updateLockoutUI();
}

export function updateLockoutUI(): void {
  const el = $('loginLockout'), submitBtn = $('loginBtn') as HTMLButtonElement, passwordInput = $('loginPassword') as HTMLInputElement;
  const rem = Math.max(0, Math.ceil((state.clientLockoutUntil - Date.now()) / 1000));
  if (rem > 0) {
    el.textContent = `🔒 Locked — ${formatTime(rem)}`;
    el.style.display = 'block';
    submitBtn.disabled = true;
    passwordInput.disabled = true;
    state.lockoutTimer = setTimeout(updateLockoutUI, 1000);
  } else {
    el.style.display = 'none';
    submitBtn.disabled = false;
    passwordInput.disabled = false;
    localStorage.removeItem(STORAGE_KEYS.lockout);
    if (state.lockoutTimer) clearTimeout(state.lockoutTimer);
  }
}

export async function doLogin(): Promise<void> {
  const password = ($('loginPassword') as HTMLInputElement).value;
  const errorEl = $('loginError'), attemptsEl = $('loginAttempts'), submitBtn = $('loginBtn') as HTMLButtonElement;
  errorEl.textContent = ''; attemptsEl.style.display = 'none';
  if (!password) { errorEl.textContent = 'Enter a password'; return; }
  if (password.length < 8) { errorEl.textContent = 'Min 8 characters'; return; }
  if (state.clientLockoutUntil > Date.now()) { updateLockoutUI(); return; }
  submitBtn.disabled = true; submitBtn.textContent = '⏳ Hashing...';
  try {
    const cr = await fetch(API_PATHS.challenge);
    if (cr.status === 429) { const d = await cr.json(); startLockoutCountdown(d.lockedFor); return; }
    const { nonce, timestamp, bcryptSalt } = await cr.json();
    const costMatch = bcryptSalt.match(/^\$2[aby]?\$(\d+)\$/);
    const cost = costMatch ? parseInt(costMatch[1]) : BCRYPT.minCost;
    if (cost > BCRYPT.maxCost) {
      errorEl.textContent = `bcrypt cost ${cost} is too high for browser. Set BCRYPT_COST=${BCRYPT.minCost} in .env and re-run hash-password.ts`;
      submitBtn.disabled = false; submitBtn.textContent = '🔓 Unlock'; return;
    }
    const s1 = await sha256Hex(password);
    const bh = bcrypt.hashSync(s1, bcryptSalt);
    const v = await sha256Hex(bh);
    const proof = await sha256Hex(v + nonce + timestamp);
    const lr = await fetch(API_PATHS.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof, timestamp })
    });
    const ld = await lr.json();
    if (lr.status === 429) { startLockoutCountdown(ld.lockedFor); playQuack(); return; }
    if (!lr.ok) {
      errorEl.textContent = 'Wrong password'; playQuack();
      if (ld.attemptsRemaining !== undefined) {
        attemptsEl.textContent = ld.attemptsRemaining > 0 ? `${ld.attemptsRemaining} attempt${ld.attemptsRemaining !== 1 ? 's' : ''} left` : 'No attempts left';
        attemptsEl.style.display = 'block';
      }
      return;
    }
    state.authToken = ld.token;
    localStorage.setItem(STORAGE_KEYS.token, state.authToken);
    localStorage.removeItem(STORAGE_KEYS.lockout);
    $('loginOverlay').classList.add('hidden');
    await loadProviders();
  } catch (e) {
    errorEl.textContent = 'Login failed: ' + ((e as Error).message || 'unable to reach server');
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = '🔓 Unlock';
  }
}

export function renderProviders(): void {
  const bar = $('providerBar');
  bar.innerHTML = '<span class="provider-label">AI:</span>';
  if (!state.availableProviders.length) { ($('verifyBtn') as HTMLButtonElement).disabled = true; return; }
  const sel = document.createElement('select');
  sel.className = 'provider-select';
  let foundCurrent = false;
  state.availableProviders.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${p.name} ${p.cost === 'free' ? '(free)' : p.cost === 'low' ? '($)' : '($$)'}`;
    if (state.selectedProvider === p.id && state.selectedModel === p.model) { opt.selected = true; foundCurrent = true; }
    sel.appendChild(opt);
  });
  if (!foundCurrent) {
    sel.selectedIndex = 0;
    const first = state.availableProviders[0];
    state.selectedProvider = first.id; state.selectedModel = first.model;
    localStorage.setItem(STORAGE_KEYS.provider, first.id); localStorage.setItem(STORAGE_KEYS.model, first.model);
  }
  sel.onchange = () => {
    const p = state.availableProviders[parseInt(sel.value)];
    state.selectedProvider = p.id; state.selectedModel = p.model;
    localStorage.setItem(STORAGE_KEYS.provider, p.id); localStorage.setItem(STORAGE_KEYS.model, p.model);
  };
  bar.appendChild(sel);
  ($('verifyBtn') as HTMLButtonElement).disabled = false;

  // Show compare toggle if 2+ providers
  const compareToggle = $('compareToggle');
  if (compareToggle) {
    compareToggle.style.display = state.availableProviders.length >= 2 ? 'inline-flex' : 'none';
  }
  // Build second provider select for compare mode
  const wrap = $('compareProviderWrap');
  if (wrap && state.availableProviders.length >= 2) {
    const sel2 = document.createElement('select');
    sel2.className = 'provider-select';
    sel2.id = 'compareProviderSelect';
    state.availableProviders.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${p.name} ${p.cost === 'free' ? '(free)' : p.cost === 'low' ? '($)' : '($$)'}`;
      if (i === 1) opt.selected = true;
      sel2.appendChild(opt);
    });
    wrap.innerHTML = '';
    wrap.appendChild(sel2);
  }
}
