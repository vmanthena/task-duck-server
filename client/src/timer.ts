import { $, formatTime } from './utils.js';
import { state } from './state.js';
import { ICON } from './icons.js';
import { showCreep } from './checkpoint.js';

let paceAlerted50 = false;
let paceAlerted75 = false;

function updatePace(): void {
  const pi = $('paceIndicator');
  if (!pi || state.totalPlannedMinutes <= 0) { if (pi) pi.textContent = ''; return; }
  const elapsedMin = state.workTimerSeconds / 60;
  const timePct = elapsedMin / state.totalPlannedMinutes;
  const doneItems = state.diffItems.filter(d => d.status === 'done').length;
  const totalItems = state.diffItems.length;
  const taskPct = totalItems > 0 ? doneItems / totalItems : 0;

  pi.classList.remove('pace-ahead', 'pace-on', 'pace-behind');
  if (timePct < 0.1) {
    pi.textContent = '';
    return;
  }
  if (taskPct >= timePct) {
    pi.textContent = 'Ahead';
    pi.classList.add('pace-ahead');
  } else if (taskPct >= timePct - 0.15) {
    pi.textContent = 'On pace';
    pi.classList.add('pace-on');
  } else {
    pi.textContent = 'Behind';
    pi.classList.add('pace-behind');
  }

  // Milestone alerts
  if (timePct >= 0.5 && !paceAlerted50 && taskPct < timePct - 0.15) {
    paceAlerted50 = true;
    showCreep("50% time used but you're behind pace. Stay focused!");
  }
  if (timePct >= 0.75 && !paceAlerted75 && taskPct < timePct - 0.15) {
    paceAlerted75 = true;
    showCreep("75% time gone — pick up the pace or consider cutting scope!");
  }
}

export function startWorkTimer(): void {
  state.workTimerSeconds = 0;
  state.workTimerPaused = false;
  paceAlerted50 = false;
  paceAlerted75 = false;
  $('workTimer').classList.add('active');
  $('workTimerBtn').innerHTML = ICON.pause;
  state.workTimerInterval = setInterval(() => {
    if (!state.workTimerPaused) {
      state.workTimerSeconds++;
      $('workTimerDisplay').textContent = formatTime(state.workTimerSeconds);
      if (state.workTimerSeconds % 30 === 0) updatePace();
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
