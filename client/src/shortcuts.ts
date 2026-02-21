import { state } from './state.js';
import { quackDuck } from './duck.js';
import { printPlan } from './export.js';
import { exportMarkdown } from './export.js';
import { scheduleSave } from './draft.js';
import { activateStep, completeStep, goBack, isStepAccessible } from './steps.js';

export function initShortcuts(): void {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') quackDuck();
    if (e.ctrlKey && e.key === 'p') { e.preventDefault(); if (state.currentStep >= 2) printPlan(); else window.print(); }
    if (e.ctrlKey && e.key === 'm') { e.preventDefault(); exportMarkdown(); }

    // Alt+1/2/3/4: jump to step
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 4 && isStepAccessible(num)) {
        e.preventDefault();
        if (num < state.currentStep) goBack(num);
        else if (num === state.currentStep) { /* already there */ }
      }
    }
    // Alt+N: complete current step (next)
    if (e.altKey && e.key === 'n') {
      e.preventDefault();
      if (state.currentStep <= 3) completeStep(state.currentStep);
    }
    // Alt+B: go back
    if (e.altKey && e.key === 'b') {
      e.preventDefault();
      if (state.currentStep > 1) goBack(state.currentStep - 1);
    }

    // Show keyboard hints while Alt is held
    if (e.key === 'Alt') document.body.classList.add('kb-hints-visible');
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'Alt') document.body.classList.remove('kb-hints-visible');
  });

  // Auto-save on any input
  document.addEventListener('input', () => scheduleSave());
}
