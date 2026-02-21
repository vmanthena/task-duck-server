import { $, esc } from './utils.js';
import { state } from './state.js';
import { duckSay } from './duck.js';
import { playQuack } from './sound.js';
import { getScopeItems } from './scope.js';
import { TIMERS } from '../../shared/constants.js';

export function startCheckpoints(): void {
  state.checkpointInterval = setInterval(showCheckpoint, TIMERS.checkpointMs);
}

export function stopCheckpoints(): void {
  if (state.checkpointInterval) clearInterval(state.checkpointInterval);
}

function showCheckpoint(): void {
  const scope = getScopeItems();
  $('checkpointScope').innerHTML = scope.map((s, i) => `<li onclick="this.classList.toggle('selected')" data-idx="${i}">${esc(s.text)}</li>`).join('');
  $('checkpointOverlay').classList.add('show');
  playQuack();
}

export function checkpointYes(): void {
  $('checkpointOverlay').classList.remove('show');
  duckSay("Good. Keep going.");
}

export function checkpointNo(): void {
  $('checkpointOverlay').classList.remove('show');
  showCreep("You drifted! Stop. Check your scope list. Get back on track.");
  duckSay("Drift detected during work. Review your scope fence.");
}

export function showCreep(msg: string): void {
  $('creepMessage').textContent = msg;
  $('creepAlert').classList.add('show');
  playQuack();
  setTimeout(hideCreep, TIMERS.creepAlertMs);
}

export function hideCreep(): void {
  $('creepAlert').classList.remove('show');
}
