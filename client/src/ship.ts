import { $, scoreClass } from './utils.js';
import { state } from './state.js';
import { duckSay } from './duck.js';
import { saveToHistory } from './history.js';
import { removeDraft } from './draft.js';
import { SCORE_THRESHOLDS } from '../../shared/constants.js';

export function shipIt(): void {
  const planned = state.diffItems.length;
  const done = state.diffItems.filter(d => d.status === 'done').length;
  const extraCount = state.extras.length;
  const amendCount = state.amendments.length;
  const deduction = extraCount * SCORE_THRESHOLDS.extraPenalty;
  const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;
  const score = Math.max(0, pct - deduction);
  $('accScore').textContent = score + '%';
  $('accScore').className = 'acc-score ' + scoreClass(score);
  $('accDetail').textContent = `${done}/${planned} planned · ${extraCount} extra · ${amendCount} amended`;
  const msg = score >= SCORE_THRESHOLDS.excellent ? "Clean ship! That's my architect! 🦆✨" : score >= SCORE_THRESHOLDS.acceptable ? "Decent, but some drift. Review what pulled you off track." : "Significant drift. Let's tighten the fence next time.";
  $('completionDuck').textContent = '🦆 "' + msg + '"';
  duckSay(msg);
  $('completionSection').classList.add('visible');
  document.querySelectorAll('.step,.step-connector').forEach(el => (el as HTMLElement).style.display = 'none');
  saveToHistory(score, done, planned, extraCount, amendCount);
  removeDraft();
}
