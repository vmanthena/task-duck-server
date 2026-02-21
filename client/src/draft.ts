import { $ } from './utils.js';
import { state } from './state.js';
import { getScopeItems, addScope } from './scope.js';
import { gatherFormData, setFormData } from './formData.js';
import { TIMERS, STORAGE_KEYS } from '../../shared/constants.js';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, TIMERS.draftDebounceMs);
}

function saveDraft(): void {
  const fields = gatherFormData();
  const data = {
    ...fields,
    scope: getScopeItems(),
    currentStep: state.currentStep,
    lastVerdict: state.lastVerdict,
    status: 'draft',
    date: new Date().toISOString()
  };
  if (!data.raw && !data.ask && !data.title) return;
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(data));
  const ind = $('autosaveInd');
  ind.classList.add('show');
  setTimeout(() => ind.classList.remove('show'), TIMERS.autosaveFlashMs);
}

export function loadDraft(): boolean {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEYS.draft) || 'null');
    if (!d) return false;
    setFormData(d);
    // Only restore lastVerdict as 'match' — non-match verdicts require
    // the user to re-verify since the verify result UI isn't restored.
    state.lastVerdict = d.lastVerdict === 'match' ? 'match' : null;
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
  } catch {
    console.warn('Draft corrupted, ignoring');
    localStorage.removeItem(STORAGE_KEYS.draft);
    return false;
  }
}

export function removeDraft(): void {
  localStorage.removeItem(STORAGE_KEYS.draft);
}
