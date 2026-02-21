import { $, esc } from './utils.js';
import { state } from './state.js';
import { duckSay } from './duck.js';
import { getScopeItems } from './scope.js';
import { addScope } from './scope.js';
import { initScope, updateTimeSummary } from './scope.js';
import { stopWorkTimer } from './timer.js';
import { stopCheckpoints } from './checkpoint.js';
import { activateStep } from './steps.js';
import { removeDraft } from './draft.js';
import { ICON } from './icons.js';

interface HistoryItem {
  id: number;
  taskId: string;
  title: string;
  date: string;
  score: number;
  done: number;
  total: number;
  extras: number;
  amends: number;
  raw: string;
  ask: string;
  deliverable: string;
  dod: string;
  notAsked: string;
  approach: string;
  peerWho: string;
  peerSurprise: string;
  parkingLot: string;
  scope: { text: string; minutes: number }[];
  storyPoints: string;
  driftReason: string;
  lastVerdict: string | null;
  workTime: number;
  diffItems: unknown[];
  extraItems: unknown[];
  amendItems: unknown[];
  status: string;
}

function getHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem('tdHistory') || '[]'); } catch { return []; }
}

function saveHistory(h: HistoryItem[]): void {
  localStorage.setItem('tdHistory', JSON.stringify(h));
}

export function saveToHistory(score: number, done: number, total: number, extras: number, amends: number): void {
  const h = getHistory();
  h.unshift({
    id: Date.now(),
    taskId: ($('taskIdField') as HTMLInputElement).value,
    title: ($('taskTitleField') as HTMLInputElement).value,
    date: new Date().toISOString(),
    score, done, total, extras, amends,
    raw: ($('rawTaskField') as HTMLTextAreaElement).value,
    ask: ($('askField') as HTMLTextAreaElement).value,
    deliverable: ($('deliverableField') as HTMLTextAreaElement).value,
    dod: ($('dodField') as HTMLTextAreaElement).value,
    notAsked: ($('notAskedField') as HTMLTextAreaElement).value,
    approach: ($('approachField') as HTMLTextAreaElement).value,
    peerWho: ($('peerWho') as HTMLTextAreaElement).value,
    peerSurprise: ($('peerSurprise') as HTMLTextAreaElement).value,
    parkingLot: ($('parkingLot') as HTMLTextAreaElement).value,
    scope: getScopeItems(),
    storyPoints: ($('storyPointsField') as HTMLInputElement).value,
    driftReason: ($('driftReason') as HTMLInputElement).value,
    lastVerdict: state.lastVerdict,
    workTime: state.workTimerSeconds,
    diffItems: state.diffItems,
    extraItems: state.extras,
    amendItems: state.amendments,
    status: 'done'
  });
  if (h.length > 50) h.length = 50;
  saveHistory(h);
  renderHistory();
}

export function renderHistory(): void {
  const h = getHistory(), el = $('historyList');
  if (!h.length) { el.innerHTML = '<div class="history-empty">No tasks yet.</div>'; renderTrend([]); return; }
  el.innerHTML = h.map((item, i) => {
    const badge = item.status === 'draft' ? '<span class="hi-badge hi-badge-draft">DRAFT</span>' : '<span class="hi-badge hi-badge-done">DONE</span>';
    const acc = item.status === 'done' ? `<span class="hi-accuracy" style="color:${item.score >= 80 ? 'var(--green)' : item.score >= 50 ? 'var(--orange)' : 'var(--red)'}">${item.score}%</span>` : '';
    return `<div class="history-item">
      <div class="hi-id">${esc(item.taskId || 'No ID')}</div>
      <div class="hi-task">${esc(item.title || item.ask?.substring(0, 60) || 'Untitled')}</div>
      <div class="hi-meta"><span class="hi-date">${new Date(item.date).toLocaleDateString()}</span>${badge}${acc}</div>
      <div class="hi-actions">
        <button onclick="resumeTask(${i})">Resume</button>
        <button onclick="cloneTask(${i})">Clone</button>
        <button onclick="deleteTask(${i})">Delete</button>
      </div>
    </div>`;
  }).join('');
  renderTrend(h.filter(x => x.status === 'done'));
}

export function resumeTask(idx: number): void {
  const h = getHistory(), item = h[idx];
  if (!item) return;
  resetAll(true);
  ($('taskIdField') as HTMLInputElement).value = item.taskId || '';
  ($('taskTitleField') as HTMLInputElement).value = item.title || '';
  ($('rawTaskField') as HTMLTextAreaElement).value = item.raw || '';
  ($('askField') as HTMLTextAreaElement).value = item.ask || '';
  ($('deliverableField') as HTMLTextAreaElement).value = item.deliverable || '';
  ($('dodField') as HTMLTextAreaElement).value = item.dod || '';
  ($('notAskedField') as HTMLTextAreaElement).value = item.notAsked || '';
  ($('approachField') as HTMLTextAreaElement).value = item.approach || '';
  ($('peerWho') as HTMLTextAreaElement).value = item.peerWho || '';
  ($('peerSurprise') as HTMLTextAreaElement).value = item.peerSurprise || '';
  ($('parkingLot') as HTMLTextAreaElement).value = item.parkingLot || '';
  ($('storyPointsField') as HTMLInputElement).value = item.storyPoints || '';
  ($('driftReason') as HTMLInputElement).value = item.driftReason || '';
  if (item.scope?.length) {
    $('scopeList').innerHTML = '';
    item.scope.forEach(s => {
      addScope();
      const items = $('scopeList').children;
      const last = items[items.length - 1];
      (last.querySelector('input[type="text"]') as HTMLInputElement).value = s.text;
      (last.querySelector('input[type="number"]') as HTMLInputElement).value = String(s.minutes || '');
    });
  }
  state.lastVerdict = item.lastVerdict || null;
  toggleHistory();
  duckSay("Task loaded. Pick up where you left off.");
}

export function cloneTask(idx: number): void {
  const h = getHistory(), item = h[idx];
  if (!item) return;
  resetAll(true);
  ($('rawTaskField') as HTMLTextAreaElement).value = item.raw || '';
  ($('deliverableField') as HTMLTextAreaElement).value = item.deliverable || '';
  ($('notAskedField') as HTMLTextAreaElement).value = item.notAsked || '';
  toggleHistory();
  duckSay("Cloned! Rewrite your understanding fresh for this run.");
}

export function deleteTask(idx: number): void {
  if (!confirm('Delete this task?')) return;
  const h = getHistory();
  h.splice(idx, 1);
  saveHistory(h);
  renderHistory();
}

function renderTrend(done: HistoryItem[]): void {
  const el = $('trendDashboard');
  if (done.length < 3) { el.innerHTML = ''; return; }
  const recent = done.slice(0, 20);
  const avgScore = Math.round(recent.reduce((a, b) => a + b.score, 0) / recent.length);
  const withTime = recent.filter(x => x.workTime);
  const avgTime = withTime.length ? Math.round(withTime.reduce((a, b) => a + b.workTime, 0) / withTime.length / 60) : 0;
  const totalExtras = recent.reduce((a, b) => a + (b.extras || 0), 0);
  const maxScore = Math.max(...recent.map(x => x.score), 1);
  const bars = recent.slice().reverse().map(x => `<div class="bar" style="height:${Math.max(4, (x.score / maxScore) * 40)}px;background:${x.score >= 80 ? 'var(--green)' : x.score >= 50 ? 'var(--orange)' : 'var(--red)'}"></div>`).join('');
  el.innerHTML = `<div class="trend-section"><h4>${ICON.trendingUp} Trends (last ${recent.length} tasks)</h4><div class="trend-row"><div class="trend-stat"><div class="ts-num" style="color:${avgScore >= 80 ? 'var(--green)' : avgScore >= 50 ? 'var(--orange)' : 'var(--red)'}">${avgScore}%</div><div class="ts-lbl">Avg accuracy</div></div><div class="trend-stat"><div class="ts-num" style="color:var(--orange)">${avgTime}m</div><div class="ts-lbl">Avg time</div></div><div class="trend-stat"><div class="ts-num" style="color:var(--purple)">${totalExtras}</div><div class="ts-lbl">Total extras</div></div></div><div class="trend-sparkline">${bars}</div></div>`;
}

export function toggleHistory(): void {
  $('historyPanel').classList.toggle('open');
  $('overlay').classList.toggle('show');
}

export function resetAll(silent?: boolean): void {
  ['rawTaskField', 'askField', 'deliverableField', 'dodField', 'notAskedField', 'taskIdField', 'taskTitleField', 'storyPointsField', 'approachField', 'peerWho', 'peerSurprise', 'parkingLot', 'driftReason', 'rescopeJustification'].forEach(id => {
    ($(id) as HTMLInputElement | HTMLTextAreaElement).value = '';
  });
  initScope(); updateTimeSummary();
  state.lastVerdict = null; state.verifyAttempts = 0;
  state.extras = []; state.amendments = []; state.diffItems = [];
  $('verifyResult').className = 'verify-result';
  $('verifyResult').innerHTML = '';
  $('driftOverride').classList.remove('visible');
  $('rescopeSection').classList.remove('visible');
  $('completionSection').classList.remove('visible');
  document.querySelectorAll('.step,.step-connector').forEach(el => (el as HTMLElement).style.display = '');
  $('verifyBtn').innerHTML = `${ICON.checkCircle} Verify`;
  activateStep(1); stopWorkTimer(); stopCheckpoints();
  if (!silent) { removeDraft(); duckSay("Fresh start! Paste a new task below."); }
}
