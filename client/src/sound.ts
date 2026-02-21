import { $ } from './utils.js';
import { state } from './state.js';
import { ICON } from './icons.js';
import { STORAGE_KEYS } from '../../shared/constants.js';

const QUACK_DATA = './assets/duck-quack.m4a';

export function playQuack(): void {
  if (!state.soundEnabled) return;
  try {
    const audio = new Audio(QUACK_DATA);
    audio.volume = state.volume / 100;
    audio.play().catch(() => {});
  } catch { /* audio playback not available */ }
}

export function toggleSound(): void {
  state.soundEnabled = !state.soundEnabled;
  localStorage.setItem(STORAGE_KEYS.sound, String(state.soundEnabled));
  updateSoundUI();
  if (state.soundEnabled) playQuack();
}

export function setVolume(val: number): void {
  state.volume = Math.max(0, Math.min(100, val));
  localStorage.setItem(STORAGE_KEYS.volume, String(state.volume));
  $('volumeLevel').textContent = state.volume + '%';
}

export function updateSoundUI(): void {
  $('soundIcon').innerHTML = state.soundEnabled ? ICON.volume2 : ICON.volumeX;
  $('soundLabel').textContent = state.soundEnabled ? 'SOUND ON' : 'SOUND OFF';
  $('volumeLevel').textContent = state.volume + '%';
  ($('volumeSlider') as HTMLInputElement).value = String(state.volume);
}
