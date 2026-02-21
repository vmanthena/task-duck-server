import { $ } from './utils.js';
import { showCreep } from './checkpoint.js';
import { scheduleSave } from './draft.js';

export interface ScopeItem {
  text: string;
  minutes: number;
}

export function addScope(): void {
  const list = $('scopeList');
  if (list.children.length >= 5) { showCreep('5 items max! If you need more, the task is too big.'); return; }
  const div = document.createElement('div');
  div.className = 'scope-item';
  div.innerHTML = '<input type="text" placeholder="I will do this..." oninput="checkScope()"><input type="number" placeholder="min" min="1" max="480" oninput="updateTimeSummary()"><span class="time-label">min</span><button class="remove-btn" onclick="removeScope(this)">×</button>';
  list.appendChild(div);
  updateAddBtn();
  scheduleSave();
}

export function removeScope(btn: HTMLElement): void {
  btn.parentElement!.remove();
  updateAddBtn();
  updateTimeSummary();
  checkScope();
  scheduleSave();
}

function updateAddBtn(): void {
  $('addScopeBtn').style.display = $('scopeList').children.length >= 5 ? 'none' : 'inline-flex';
}

export function getScopeItems(): ScopeItem[] {
  return [...document.querySelectorAll('.scope-item')].map(el => ({
    text: (el.querySelector('input[type="text"]') as HTMLInputElement).value.trim(),
    minutes: parseInt((el.querySelector('input[type="number"]') as HTMLInputElement).value) || 0
  })).filter(s => s.text);
}

export function updateTimeSummary(): void {
  const items = getScopeItems();
  const total = items.reduce((a, b) => a + b.minutes, 0);
  const el = $('totalTime');
  el.textContent = total ? `${total} min (~${(total / 60).toFixed(1)}h)` : '0 min';
  el.className = total > 240 ? 'ts-warn' : total > 0 ? 'ts-ok' : 'ts-value';
}

export function checkScope(): void {
  const n = getScopeItems().length;
  ($('step2Btn') as HTMLButtonElement).disabled = n < 1;
}

export function initScope(): void {
  const list = $('scopeList');
  list.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const div = document.createElement('div');
    div.className = 'scope-item';
    div.innerHTML = '<input type="text" placeholder="I will do this..." oninput="checkScope()"><input type="number" placeholder="min" min="1" max="480" oninput="updateTimeSummary()"><span class="time-label">min</span><button class="remove-btn" onclick="removeScope(this)">×</button>';
    list.appendChild(div);
  }
}
