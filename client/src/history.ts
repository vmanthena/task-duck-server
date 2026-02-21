import { $, esc, scoreColor, scoreClass } from './utils.js';
import { state } from './state.js';
import { duckSay } from './duck.js';
import { getScopeItems, addScope, initScope, updateTimeSummary } from './scope.js';
import { stopWorkTimer } from './timer.js';
import { stopCheckpoints } from './checkpoint.js';
import { activateStep } from './steps.js';
import { removeDraft } from './draft.js';
import { ICON } from './icons.js';
import { gatherFormData, setFormData, clearFormData } from './formData.js';
import { STORAGE_KEYS } from '../../shared/constants.js';

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
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]');
  } catch {
    console.warn('History corrupted, clearing');
    localStorage.removeItem(STORAGE_KEYS.history);
    return [];
  }
}

function saveHistory(h: HistoryItem[]): void {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(h));
}

export function saveToHistory(score: number, done: number, total: number, extras: number, amends: number): void {
  const h = getHistory();
  const fields = gatherFormData();
  h.unshift({
    id: Date.now(),
    taskId: fields.taskId,
    title: fields.title,
    date: new Date().toISOString(),
    score, done, total, extras, amends,
    raw: fields.raw,
    ask: fields.ask,
    deliverable: fields.deliverable,
    dod: fields.dod,
    notAsked: fields.notAsked,
    approach: fields.approach,
    peerWho: fields.peerWho,
    peerSurprise: fields.peerSurprise,
    parkingLot: fields.parkingLot,
    scope: getScopeItems(),
    storyPoints: fields.storyPoints,
    driftReason: fields.driftReason,
    lastVerdict: state.lastVerdict,
    workTime: state.workTimerSeconds,
    diffItems: state.diffItems,
    extraItems: state.extras,
    amendItems: state.amendments,
    status: 'done'
  });
  if (h.length > 50) h.length = 50;
  saveHistory(h);
  updateStreak();
  renderHistory();
}

function updateStreak(): void {
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = localStorage.getItem(STORAGE_KEYS.lastTaskDate) || '';
  let streak = parseInt(localStorage.getItem(STORAGE_KEYS.streak) || '0');
  if (lastDate === today) {
    // Already counted today
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak = lastDate === yesterday ? streak + 1 : 1;
  }
  localStorage.setItem(STORAGE_KEYS.streak, String(streak));
  localStorage.setItem(STORAGE_KEYS.lastTaskDate, today);
}

export function renderHistory(): void {
  const h = getHistory(), el = $('historyList');
  if (!h.length) { el.innerHTML = '<div class="history-empty">No tasks yet.</div>'; renderTrend([]); return; }
  el.innerHTML = h.map((item, i) => {
    const badge = item.status === 'draft' ? '<span class="hi-badge hi-badge-draft">DRAFT</span>' : '<span class="hi-badge hi-badge-done">DONE</span>';
    const acc = item.status === 'done' ? `<span class="hi-accuracy ${scoreClass(item.score)}">${item.score}%</span>` : '';
    return `<div class="history-item">
      <div class="hi-id">${esc(item.taskId || 'No ID')}</div>
      <div class="hi-task">${esc(item.title || item.ask?.substring(0, 60) || 'Untitled')}</div>
      <div class="hi-meta"><span class="hi-date">${new Date(item.date).toLocaleDateString()}</span>${badge}${acc}</div>
      <div class="hi-actions">
        <button onclick="resumeTask(${i})">Resume</button>
        <button onclick="cloneTask(${i})">Clone</button>
        <button onclick="templateFromTask(${i})">Template</button>
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
  setFormData({
    taskId: item.taskId || '',
    title: item.title || '',
    raw: item.raw || '',
    ask: item.ask || '',
    deliverable: item.deliverable || '',
    dod: item.dod || '',
    notAsked: item.notAsked || '',
    approach: item.approach || '',
    peerWho: item.peerWho || '',
    peerSurprise: item.peerSurprise || '',
    parkingLot: item.parkingLot || '',
    storyPoints: item.storyPoints || '',
    driftReason: item.driftReason || '',
  });
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
  setFormData({
    raw: item.raw || '',
    deliverable: item.deliverable || '',
    notAsked: item.notAsked || '',
  });
  toggleHistory();
  duckSay("Cloned! Rewrite your understanding fresh for this run.");
}

export function templateFromTask(idx: number): void {
  const h = getHistory(), item = h[idx];
  if (!item) return;
  resetAll(true);
  setFormData({
    approach: item.approach || '',
    peerWho: item.peerWho || '',
    parkingLot: item.parkingLot || '',
  });
  toggleHistory();
  duckSay("Template loaded. Fill in the rest fresh.");
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
  const bars = recent.slice().reverse().map(x => `<div class="bar" style="height:${Math.max(4, (x.score / maxScore) * 40)}px;background:${scoreColor(x.score)}"></div>`).join('');
  const streak = parseInt(localStorage.getItem(STORAGE_KEYS.streak) || '0');
  const last5 = done.slice(0, 5);
  const discipline = last5.length >= 3 ? Math.round(last5.reduce((a, b) => a + b.score, 0) / last5.length) : 0;
  let streakHtml = '';
  if (streak > 0) streakHtml = `<div class="trend-stat"><div class="ts-num color--yellow">${streak}</div><div class="ts-lbl">Day streak</div></div>`;
  let disciplineHtml = '';
  if (discipline > 0) disciplineHtml = `<div class="trend-stat"><div class="ts-num ${scoreClass(discipline)}">${discipline}%</div><div class="ts-lbl">Discipline</div></div>`;
  el.innerHTML = `<div class="trend-section"><h4>${ICON.trendingUp} Trends (last ${recent.length} tasks)</h4><div class="trend-row"><div class="trend-stat"><div class="ts-num ${scoreClass(avgScore)}">${avgScore}%</div><div class="ts-lbl">Avg accuracy</div></div><div class="trend-stat"><div class="ts-num color--orange">${avgTime}m</div><div class="ts-lbl">Avg time</div></div><div class="trend-stat"><div class="ts-num color--purple">${totalExtras}</div><div class="ts-lbl">Total extras</div></div>${streakHtml}${disciplineHtml}</div><div class="trend-sparkline">${bars}</div></div>`;
}

export function toggleHistory(): void {
  $('historyPanel').classList.toggle('open');
  $('overlay').classList.toggle('show');
}

export function resetAll(silent?: boolean): void {
  clearFormData();
  initScope(); updateTimeSummary();
  state.lastVerdict = null; state.verifyAttempts = 0;
  state.extras = []; state.amendments = []; state.diffItems = [];
  state.verificationHistory = [];
  state.totalPlannedMinutes = 0;
  state.compareMode = false;
  state.vrCollapsed.clear();
  $('verifyResult').className = 'verify-result';
  $('verifyResult').innerHTML = '';
  const vh = $('verificationHistory');
  if (vh) vh.innerHTML = '';
  $('driftOverride').classList.remove('visible');
  $('rescopeSection').classList.remove('visible');
  $('completionSection').classList.remove('visible');
  document.querySelectorAll('.step,.step-connector').forEach(el => (el as HTMLElement).style.display = '');
  $('verifyBtn').innerHTML = `${ICON.checkCircle} Verify`;
  activateStep(1); stopWorkTimer(); stopCheckpoints();
  if (!silent) { removeDraft(); duckSay("Fresh start! Paste a new task below."); }
}
