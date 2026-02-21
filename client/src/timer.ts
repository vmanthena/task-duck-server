import { $ } from './utils.js';
import { state } from './state.js';
import { ICON } from './icons.js';

export function startWorkTimer(): void {
  state.workTimerSeconds = 0;
  state.workTimerPaused = false;
  $('workTimer').classList.add('active');
  $('workTimerBtn').innerHTML = ICON.pause;
  state.workTimerInterval = setInterval(() => {
    if (!state.workTimerPaused) {
      state.workTimerSeconds++;
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay(): void {
  const m = Math.floor(state.workTimerSeconds / 60);
  const s = state.workTimerSeconds % 60;
  $('workTimerDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function toggleWorkTimer(): void {
  state.workTimerPaused = !state.workTimerPaused;
  $('workTimerBtn').innerHTML = state.workTimerPaused ? ICON.play : ICON.pause;
}

export function pauseWorkTimer(): void {
  state.workTimerPaused = true;
  $('workTimerBtn').innerHTML = ICON.play;
}

export function stopWorkTimer(): void {
  if (state.workTimerInterval) clearInterval(state.workTimerInterval);
  state.workTimerInterval = null;
  $('workTimer').classList.remove('active');
}
