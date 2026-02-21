import { $ } from './utils.js';
import { state } from './state.js';
import { duckSay } from './duck.js';
import { playQuack } from './sound.js';
import { getScopeItems } from './scope.js';
import { buildDiffTracker } from './diff.js';
import { startWorkTimer, stopWorkTimer, pauseWorkTimer } from './timer.js';
import { startCheckpoints, stopCheckpoints } from './checkpoint.js';
import { buildCheckQuestions } from './checks.js';
import { scheduleSave } from './draft.js';
import { onboardNextStep } from './onboarding.js';

export function activateStep(n: number): void {
  state.currentStep = n;
  for (let i = 1; i <= 4; i++) {
    const s = $('step' + i);
    if (!s) continue;
    s.classList.remove('active', 'reopened');
    if (i < n) s.classList.add('completed');
    else if (i === n) s.classList.add('active');
    else s.classList.remove('completed');
  }
  scheduleSave();
  // Scroll new step into view after transition
  setTimeout(() => {
    const el = $('step' + n);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

export function reopenStep(n: number): void {
  if (n >= state.currentStep) return;
  const s = $('step' + n);
  if (s.classList.contains('reopened')) {
    s.classList.remove('reopened');
  } else {
    for (let i = 1; i < state.currentStep; i++) {
      if (i !== n) $('step' + i)?.classList.remove('reopened');
    }
    s.classList.add('reopened');
    if (state.currentStep === 3 && state.workTimerInterval) {
      pauseWorkTimer();
      duckSay('Timer paused while you review.');
    }
  }
}

export function isStepAccessible(n: number): boolean {
  if (n < 1 || n > 4) return false;
  if (n <= state.currentStep) return true;
  const stepEl = $('step' + n);
  return stepEl?.classList.contains('completed') || stepEl?.classList.contains('reopened') || false;
}

export function completeStep(n: number): void {
  if (n === 1) {
    if (state.lastVerdict && state.lastVerdict !== 'match') {
      const reason = ($('driftReason') as HTMLInputElement).value.trim();
      if (!reason) {
        $('driftOverride').classList.add('visible');
        duckSay("You had drift. Explain why you're proceeding or re-verify.");
        playQuack();
        return;
      }
    }
    activateStep(2);
    duckSay("Good. Now set your fence — what EXACTLY will you do?");
    onboardNextStep(2);
  } else if (n === 2) {
    const items = getScopeItems();
    if (items.length < 1) { duckSay("Add at least one scope item before starting work."); playQuack(); return; }
    state.totalPlannedMinutes = items.reduce((a, b) => a + b.minutes, 0);
    activateStep(3); buildDiffTracker(); startWorkTimer(); startCheckpoints();
    duckSay("Timer started. Stay inside the fence. I'll check in every 30 min.");
    onboardNextStep(3);
  } else if (n === 3) {
    stopWorkTimer(); stopCheckpoints(); activateStep(4); buildCheckQuestions();
    duckSay("Done? Let's verify before you push.");
    onboardNextStep(4);
  }
}

export function goBack(toStep: number): void {
  state.currentStep = toStep;
  for (let i = 1; i <= 4; i++) {
    const s = $('step' + i);
    s.classList.remove('active', 'completed', 'reopened');
    if (i < toStep) s.classList.add('completed');
    else if (i === toStep) s.classList.add('active');
  }
}

export function pauseAndGoBack(toStep: number): void {
  if (state.workTimerInterval) pauseWorkTimer();
  goBack(toStep);
  duckSay("Timer paused. Review your plan, then come back.");
}
