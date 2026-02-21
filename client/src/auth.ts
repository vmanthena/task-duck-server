import bcrypt from 'bcryptjs';
import { $ } from './utils.js';
import { state } from './state.js';
import { playQuack } from './sound.js';
import { loadProviders } from './api.js';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function togglePasswordVis(): void {
  const i = $('loginPassword') as HTMLInputElement;
  const s = $('pwEyeShow'), h = $('pwEyeHide');
  if (i.type === 'password') {
    i.type = 'text'; s.style.display = 'none'; h.style.display = 'block';
  } else {
    i.type = 'password'; s.style.display = 'block'; h.style.display = 'none';
  }
  i.focus();
}

export function startLockoutCountdown(sec: number): void {
  state.clientLockoutUntil = Date.now() + (sec * 1000);
  localStorage.setItem('tdLockout', String(state.clientLockoutUntil));
  updateLockoutUI();
}

export function updateLockoutUI(): void {
  const el = $('loginLockout'), btn = $('loginBtn') as HTMLButtonElement, pw = $('loginPassword') as HTMLInputElement;
  const rem = Math.max(0, Math.ceil((state.clientLockoutUntil - Date.now()) / 1000));
  if (rem > 0) {
    const m = Math.floor(rem / 60), s = rem % 60;
    el.textContent = `🔒 Locked — ${m}:${String(s).padStart(2, '0')}`;
    el.style.display = 'block';
    btn.disabled = true;
    pw.disabled = true;
    state.lockoutTimer = setTimeout(updateLockoutUI, 1000);
  } else {
    el.style.display = 'none';
    btn.disabled = false;
    pw.disabled = false;
    localStorage.removeItem('tdLockout');
    if (state.lockoutTimer) clearTimeout(state.lockoutTimer);
  }
}

export async function doLogin(): Promise<void> {
  const pw = ($('loginPassword') as HTMLInputElement).value;
  const err = $('loginError'), att = $('loginAttempts'), btn = $('loginBtn') as HTMLButtonElement;
  err.textContent = ''; att.style.display = 'none';
  if (!pw) { err.textContent = 'Enter a password'; return; }
  if (pw.length < 8) { err.textContent = 'Min 8 characters'; return; }
  if (state.clientLockoutUntil > Date.now()) { updateLockoutUI(); return; }
  btn.disabled = true; btn.textContent = '⏳ Hashing...';
  try {
    const cr = await fetch('/api/auth/challenge');
    if (cr.status === 429) { const d = await cr.json(); startLockoutCountdown(d.lockedFor); return; }
    const { nonce, timestamp, bcryptSalt } = await cr.json();
    const costMatch = bcryptSalt.match(/^\$2[aby]?\$(\d+)\$/);
    const cost = costMatch ? parseInt(costMatch[1]) : 15;
    if (cost > 16) {
      err.textContent = `bcrypt cost ${cost} is too high for browser. Set BCRYPT_COST=15 in .env and re-run hash-password.ts`;
      btn.disabled = false; btn.textContent = '🔓 Unlock'; return;
    }
    const s1 = await sha256Hex(pw);
    const bh = bcrypt.hashSync(s1, bcryptSalt);
    const v = await sha256Hex(bh);
    const proof = await sha256Hex(v + nonce + timestamp);
    const lr = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof, timestamp })
    });
    const ld = await lr.json();
    if (lr.status === 429) { startLockoutCountdown(ld.lockedFor); playQuack(); return; }
    if (!lr.ok) {
      err.textContent = 'Wrong password'; playQuack();
      if (ld.attemptsRemaining !== undefined) {
        att.textContent = ld.attemptsRemaining > 0 ? `${ld.attemptsRemaining} attempt${ld.attemptsRemaining !== 1 ? 's' : ''} left` : 'No attempts left';
        att.style.display = 'block';
      }
      return;
    }
    state.authToken = ld.token;
    localStorage.setItem('tdToken', state.authToken);
    localStorage.removeItem('tdLockout');
    $('loginOverlay').classList.add('hidden');
    await loadProviders();
  } catch (e) {
    err.textContent = (e as Error).message || 'Connection error';
  } finally {
    btn.disabled = false; btn.textContent = '🔓 Unlock';
  }
}

export function renderProviders(): void {
  const bar = $('providerBar');
  bar.innerHTML = '<span style="font-family:var(--mono);font-size:.65rem;color:var(--text-muted);padding:.3rem 0">AI:</span>';
  if (!state.availableProviders.length) { ($('verifyBtn') as HTMLButtonElement).disabled = true; return; }
  const sel = document.createElement('select');
  sel.style.cssText = 'font-family:var(--mono);font-size:.72rem;padding:.3rem .5rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--yellow);cursor:pointer;outline:none';
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
    localStorage.setItem('tdProvider', first.id); localStorage.setItem('tdModel', first.model);
  }
  sel.onchange = () => {
    const p = state.availableProviders[parseInt(sel.value)];
    state.selectedProvider = p.id; state.selectedModel = p.model;
    localStorage.setItem('tdProvider', p.id); localStorage.setItem('tdModel', p.model);
  };
  bar.appendChild(sel);
  ($('verifyBtn') as HTMLButtonElement).disabled = false;
}
