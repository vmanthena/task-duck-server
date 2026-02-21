import { $, esc } from './utils.js';
import { state } from './state.js';
import { duckSay } from './duck.js';
import { playQuack } from './sound.js';
import { getScopeItems } from './scope.js';
import { showCreep } from './checkpoint.js';
import { scheduleSave } from './draft.js';

export function buildDiffTracker(): void {
  const scope = getScopeItems();
  state.diffItems = scope.map((s, i) => ({ text: s.text, minutes: s.minutes, status: 'pending', type: 'planned', idx: i }));
  state.extras = [];
  state.amendments = [];
  renderDiff();
}

export function renderDiff(): void {
  const el = $('diffList');
  const all = [...state.diffItems, ...state.extras, ...state.amendments];
  el.innerHTML = all.map((item, i) => {
    const st = item.status === 'done' ? 'diff-done' : item.status === 'skipped' ? 'diff-skipped' : item.type === 'extra' ? 'diff-extra' : item.type === 'amendment' ? 'diff-amended' : '';
    const label = item.status === 'done' ? 'DONE' : item.status === 'skipped' ? 'SKIP' : item.type === 'extra' ? 'EXTRA' : item.type === 'amendment' ? 'AMEND' : 'TODO';
    return `<div class="diff-item"><span class="diff-planned">${esc(item.text)}</span><span class="diff-status ${st}" onclick="toggleDiffStatus(${i},'${item.type}')">${label}</span></div>`;
  }).join('');
}

export function toggleDiffStatus(idx: number, type: string): void {
  let item;
  if (type === 'extra') item = state.extras[idx - state.diffItems.length];
  else if (type === 'amendment') item = state.amendments[idx - state.diffItems.length - state.extras.length];
  else item = state.diffItems[idx];
  if (!item) return;
  if (item.type === 'planned') {
    item.status = item.status === 'pending' ? 'done' : item.status === 'done' ? 'skipped' : 'pending';
  }
  renderDiff(); scheduleSave();
}

export function addExtra(): void {
  const inp = $('extraWorkInput') as HTMLInputElement;
  const v = inp.value.trim();
  if (!v) return;
  state.extras.push({ text: v, minutes: 0, status: 'done', type: 'extra' });
  inp.value = '';
  renderDiff(); playQuack();
  showCreep("Extra work added. Is this really needed for the task?");
  scheduleSave();
}

export function showAmendment(): void {
  $('amendSection').style.display = 'block';
}

export function submitAmendment(): void {
  const reason = ($('amendReason') as HTMLTextAreaElement).value.trim();
  if (!reason) return;
  state.amendments.push({ text: reason, minutes: 0, status: 'done', type: 'amendment' });
  ($('amendReason') as HTMLTextAreaElement).value = '';
  $('amendSection').style.display = 'none';
  renderDiff();
  duckSay("Scope amendment recorded. This won't penalize your accuracy score.");
  scheduleSave();
}
