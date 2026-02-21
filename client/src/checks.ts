import { $, esc } from './utils.js';
import { state } from './state.js';

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
