import { $ } from './utils.js';
import { state } from './state.js';
import { getScopeItems, addScope } from './scope.js';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 5000);
}

function saveDraft(): void {
  const data = {
    taskId: ($('taskIdField') as HTMLInputElement).value,
    title: ($('taskTitleField') as HTMLInputElement).value,
    raw: ($('rawTaskField') as HTMLTextAreaElement).value,
    ask: ($('askField') as HTMLTextAreaElement).value,
    deliverable: ($('deliverableField') as HTMLTextAreaElement).value,
    dod: ($('dodField') as HTMLTextAreaElement).value,
    notAsked: ($('notAskedField') as HTMLTextAreaElement).value,
    approach: ($('approachField') as HTMLTextAreaElement).value,
    peerWho: ($('peerWho') as HTMLTextAreaElement).value,
    peerSurprise: ($('peerSurprise') as HTMLTextAreaElement).value,
    parkingLot: ($('parkingLot') as HTMLTextAreaElement).value,
    driftReason: ($('driftReason') as HTMLInputElement).value,
    scope: getScopeItems(),
    currentStep: state.currentStep,
    lastVerdict: state.lastVerdict,
    status: 'draft',
    date: new Date().toISOString()
  };
  if (!data.raw && !data.ask && !data.title) return;
  localStorage.setItem('tdDraft', JSON.stringify(data));
  const ind = $('autosaveInd');
  ind.classList.add('show');
  setTimeout(() => ind.classList.remove('show'), 1500);
}

export function loadDraft(): boolean {
  try {
    const d = JSON.parse(localStorage.getItem('tdDraft') || 'null');
    if (!d) return false;
    ($('taskIdField') as HTMLInputElement).value = d.taskId || '';
    ($('taskTitleField') as HTMLInputElement).value = d.title || '';
    ($('rawTaskField') as HTMLTextAreaElement).value = d.raw || '';
    ($('askField') as HTMLTextAreaElement).value = d.ask || '';
    ($('deliverableField') as HTMLTextAreaElement).value = d.deliverable || '';
    ($('dodField') as HTMLTextAreaElement).value = d.dod || '';
    ($('notAskedField') as HTMLTextAreaElement).value = d.notAsked || '';
    ($('approachField') as HTMLTextAreaElement).value = d.approach || '';
    ($('peerWho') as HTMLTextAreaElement).value = d.peerWho || '';
    ($('peerSurprise') as HTMLTextAreaElement).value = d.peerSurprise || '';
    ($('parkingLot') as HTMLTextAreaElement).value = d.parkingLot || '';
    ($('driftReason') as HTMLInputElement).value = d.driftReason || '';
    state.lastVerdict = d.lastVerdict || null;
    if (d.scope?.length) {
      $('scopeList').innerHTML = '';
      d.scope.forEach((s: { text: string; minutes: number }) => {
        addScope();
        const items = $('scopeList').children;
        const last = items[items.length - 1];
        (last.querySelector('input[type="text"]') as HTMLInputElement).value = s.text;
        (last.querySelector('input[type="number"]') as HTMLInputElement).value = String(s.minutes || '');
      });
    }
    return true;
  } catch { return false; }
}

export function removeDraft(): void {
  localStorage.removeItem('tdDraft');
}
