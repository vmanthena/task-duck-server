import { $, formatTime } from './utils.js';
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
      $('workTimerDisplay').textContent = formatTime(state.workTimerSeconds);
    }
  }, 1000);
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
