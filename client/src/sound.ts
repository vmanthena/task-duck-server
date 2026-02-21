import { $ } from './utils.js';
import { state } from './state.js';
import { ICON } from './icons.js';

const QUACK_DATA = './assets/duck-quack.m4a';

export function playQuack(): void {
  if (!state.soundEnabled) return;
  try {
    const audio = new Audio(QUACK_DATA);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}
}

export function toggleSound(): void {
  state.soundEnabled = !state.soundEnabled;
  localStorage.setItem('tdSound', String(state.soundEnabled));
  updateSoundUI();
  if (state.soundEnabled) playQuack();
}

export function updateSoundUI(): void {
  $('soundIcon').innerHTML = state.soundEnabled ? ICON.volume2 : ICON.volumeX;
  $('soundLabel').textContent = state.soundEnabled ? 'SOUND ON' : 'SOUND OFF';
}
