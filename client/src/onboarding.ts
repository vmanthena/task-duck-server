import { $ } from './utils.js';
import { state } from './state.js';
import { STORAGE_KEYS } from '../../shared/constants.js';

const TIPS: Record<number, string> = {
  1: 'Paste the original task, then rewrite it in your own words. Hit Verify to check your understanding.',
  2: 'Break work into 3–5 scope items with time estimates. This is your fence — stay inside it.',
  3: 'Mark items done as you go. Add extras or amendments if scope changes. The duck will check in.',
  4: 'Review each checkbox honestly. Your accuracy score reflects how well you stayed in scope.',
};

export function initOnboarding(): void {
  if (state.onboarded) return;
  showTip(1);
}

export function onboardNextStep(n: number): void {
  if (state.onboarded) return;
  hideTip();
  if (n <= 4) {
    showTip(n);
  }
  if (n > 4) {
    state.onboarded = true;
    localStorage.setItem(STORAGE_KEYS.onboarded, 'true');
    hideTip();
    removeHighlights();
  }
}

function showTip(step: number): void {
  const tip = TIPS[step];
  if (!tip) return;
  const tooltip = $('onboardTooltip');
  tooltip.innerHTML = `<p>${tip}</p><button class="btn btn-sm btn-primary" onclick="dismissTooltip()">Got it</button>`;
  tooltip.style.display = 'block';

  // Position near the step header
  const header = document.querySelector(`#step${step} .step-header`) as HTMLElement;
  if (header) {
    header.classList.add('onboard-highlight');
    const rect = header.getBoundingClientRect();
    tooltip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    tooltip.style.left = (rect.left + window.scrollX) + 'px';
  }
}

function hideTip(): void {
  $('onboardTooltip').style.display = 'none';
  removeHighlights();
}

function removeHighlights(): void {
  document.querySelectorAll('.onboard-highlight').forEach(el => el.classList.remove('onboard-highlight'));
}

export function dismissTooltip(): void {
  hideTip();
}
