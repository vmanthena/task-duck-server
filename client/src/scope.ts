import { $ } from './utils.js';
import { showCreep } from './checkpoint.js';
import { scheduleSave } from './draft.js';

export interface ScopeItem {
  text: string;
  minutes: number;
}

const SCOPE_ITEM_HTML = '<input type="text" placeholder="I will do this..." oninput="checkScope()"><input type="number" placeholder="min" min="1" max="480" oninput="updateTimeSummary()"><span class="time-label">min</span><button class="remove-btn" onclick="removeScope(this)">×</button>';

const SCOPE_TEMPLATES: Record<string, ScopeItem[]> = {
  'Bug Fix': [
    { text: 'Reproduce and document the bug', minutes: 15 },
    { text: 'Implement the fix', minutes: 30 },
    { text: 'Write/update tests', minutes: 20 },
  ],
  'Feature': [
    { text: 'Define acceptance criteria', minutes: 15 },
    { text: 'Implement core logic', minutes: 45 },
    { text: 'Add UI/integration', minutes: 30 },
    { text: 'Write tests', minutes: 20 },
  ],
  'Refactor': [
    { text: 'Identify and document current behavior', minutes: 20 },
    { text: 'Refactor code', minutes: 40 },
    { text: 'Verify tests still pass', minutes: 15 },
  ],
  'Spike': [
    { text: 'Research and prototype', minutes: 45 },
    { text: 'Document findings and recommendation', minutes: 20 },
  ],
};

export function addScope(): void {
  const list = $('scopeList');
  if (list.children.length >= 5) { showCreep('5 items max! If you need more, the task is too big.'); return; }
  const div = document.createElement('div');
  div.className = 'scope-item';
  div.innerHTML = SCOPE_ITEM_HTML;
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

// Scrum Fibonacci SP → expected minutes of focused work
const SP_MINUTES: Record<number, number> = {
  1: 120, 2: 240, 3: 480, 5: 720, 8: 1200, 13: 1920
};

function spToMinutes(sp: number): number {
  if (SP_MINUTES[sp]) return SP_MINUTES[sp];
  // Interpolate for non-Fibonacci values
  const keys = Object.keys(SP_MINUTES).map(Number).sort((a, b) => a - b);
  if (sp < keys[0]) return Math.round(sp * (SP_MINUTES[keys[0]] / keys[0]));
  if (sp > keys[keys.length - 1]) return Math.round(sp * (SP_MINUTES[keys[keys.length - 1]] / keys[keys.length - 1]));
  for (let i = 0; i < keys.length - 1; i++) {
    if (sp > keys[i] && sp < keys[i + 1]) {
      const ratio = (sp - keys[i]) / (keys[i + 1] - keys[i]);
      return Math.round(SP_MINUTES[keys[i]] + ratio * (SP_MINUTES[keys[i + 1]] - SP_MINUTES[keys[i]]));
    }
  }
  return sp * 120;
}

export function updateTimeSummary(): void {
  const items = getScopeItems();
  const total = items.reduce((a, b) => a + b.minutes, 0);
  const el = $('totalTime');
  el.textContent = total ? `${total} min (~${(total / 60).toFixed(1)}h)` : '0 min';
  el.className = total > 240 ? 'ts-warn' : total > 0 ? 'ts-ok' : 'ts-value';

  // SP fit validation
  const fitEl = $('spFit');
  const spVal = parseInt(($('storyPointsField') as HTMLInputElement).value);
  if (!fitEl) return;
  if (isNaN(spVal) || spVal <= 0 || total <= 0) {
    fitEl.style.display = 'none';
    return;
  }
  const expected = spToMinutes(spVal);
  const variance = 0.05;
  const lo = expected * (1 - variance);
  const hi = expected * (1 + variance);
  const diff = total - expected;
  const pct = Math.round(Math.abs(diff) / expected * 100);
  fitEl.style.display = '';
  if (total >= lo && total <= hi) {
    fitEl.className = 'sp-fit sp-fit-ok';
    fitEl.textContent = `Fits ${spVal} SP (~${expected} min expected)`;
  } else if (total < lo) {
    fitEl.className = 'sp-fit sp-fit-under';
    fitEl.textContent = `${pct}% under ${spVal} SP estimate (${total} vs ~${expected} min)`;
  } else {
    fitEl.className = 'sp-fit sp-fit-over';
    fitEl.textContent = `${pct}% over ${spVal} SP estimate (${total} vs ~${expected} min)`;
  }
}

export function checkScope(): void {
  const n = getScopeItems().length;
  ($('step2Btn') as HTMLButtonElement).disabled = n < 1;
}

export function applyTemplate(name: string): void {
  const tpl = SCOPE_TEMPLATES[name];
  if (!tpl) return;
  const existing = getScopeItems().filter(s => s.text);
  if (existing.length > 0 && !confirm('Replace current scope items with template?')) return;
  const list = $('scopeList');
  list.innerHTML = '';
  tpl.forEach(item => {
    const div = document.createElement('div');
    div.className = 'scope-item';
    div.innerHTML = SCOPE_ITEM_HTML;
    list.appendChild(div);
    (div.querySelector('input[type="text"]') as HTMLInputElement).value = item.text;
    (div.querySelector('input[type="number"]') as HTMLInputElement).value = String(item.minutes);
  });
  updateAddBtn();
  updateTimeSummary();
  checkScope();
  scheduleSave();
  const sel = $('scopeTemplateSelect') as HTMLSelectElement;
  if (sel) sel.selectedIndex = 0;
}

export function initScope(): void {
  const list = $('scopeList');
  list.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const div = document.createElement('div');
    div.className = 'scope-item';
    div.innerHTML = SCOPE_ITEM_HTML;
    list.appendChild(div);
  }
}
