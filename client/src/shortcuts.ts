import { state } from './state.js';
import { quackDuck } from './duck.js';
import { printPlan } from './export.js';
import { exportMarkdown } from './export.js';
import { scheduleSave } from './draft.js';

export function initShortcuts(): void {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') quackDuck();
    if (e.ctrlKey && e.key === 'p') { e.preventDefault(); if (state.currentStep >= 2) printPlan(); else window.print(); }
    if (e.ctrlKey && e.key === 'm') { e.preventDefault(); exportMarkdown(); }
  });

  // Auto-save on any input
  document.addEventListener('input', () => scheduleSave());
}
