import { $, esc, scoreClass } from './utils.js';
import { state } from './state.js';
import { SCORE_THRESHOLDS } from '../../shared/constants.js';

function renderDiffSummary(): void {
  const el = $('diffSummaryCard');
  if (!el) return;
  const planned = state.diffItems.length;
  const done = state.diffItems.filter(d => d.status === 'done').length;
  const skipped = state.diffItems.filter(d => d.status === 'skipped').length;
  const extraCount = state.extras.length;
  const amendCount = state.amendments.length;
  const deduction = extraCount * SCORE_THRESHOLDS.extraPenalty;
  const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;
  const projected = Math.max(0, pct - deduction);
  const cls = scoreClass(projected);
  el.innerHTML = `<h4>Diff Summary</h4><div class="ds-stats"><span class="ds-stat"><strong>${done}</strong> done</span><span class="ds-stat"><strong>${planned}</strong> planned</span><span class="ds-stat"><strong>${skipped}</strong> skipped</span><span class="ds-stat"><strong>${extraCount}</strong> extras</span><span class="ds-stat"><strong>${amendCount}</strong> amended</span></div><div class="ds-projected">Projected accuracy: <strong class="${cls}">${projected}%</strong></div>`;
  el.style.display = 'block';
}

export function buildCheckQuestions(): void {
  const dod = ($('dodField') as HTMLTextAreaElement).value.trim();
  const approach = ($('approachField') as HTMLTextAreaElement).value.trim();
  const hasExtras = state.extras.length > 0;
  const checks = [
    dod ? `My Definition of Done is met: "${dod}"` : 'I completed what was asked',
    'My diff only contains changes related to the task',
    approach ? 'I only touched files/services listed in my approach' : "I didn't modify unexpected files",
    'My reviewer would NOT ask "why did you change this?"',
    'No gold-plating — I shipped what was asked, nothing more',
  ];
  if (hasExtras) checks.push('Each unplanned extra item is justified and necessary');
  $('checkQuestions').innerHTML = checks.map(c =>
    `<div class="check-q" onclick="toggleCheck(this)"><div class="checkbox"></div><div class="check-text">${esc(c)}</div></div>`
  ).join('');
  renderDiffSummary();
  updateShipBtn();
}

export function toggleCheck(el: HTMLElement): void {
  el.classList.toggle('checked');
  el.querySelector('.checkbox')!.textContent = el.classList.contains('checked') ? '✓' : '';
  updateShipBtn();
}

export function updateShipBtn(): void {
  const all = document.querySelectorAll('.check-q');
  const checked = document.querySelectorAll('.check-q.checked');
  ($('shipBtn') as HTMLButtonElement).disabled = checked.length < all.length;
}
