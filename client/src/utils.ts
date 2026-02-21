import { SCORE_THRESHOLDS } from '../../shared/constants.js';

export const $ = (id: string): HTMLElement => document.getElementById(id)!;

export const esc = (s: string): string => {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
};

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function scoreColor(score: number): string {
  return score >= SCORE_THRESHOLDS.excellent ? 'var(--green)' : score >= SCORE_THRESHOLDS.acceptable ? 'var(--orange)' : 'var(--red)';
}

export function scoreClass(score: number): string {
  return score >= SCORE_THRESHOLDS.excellent ? 'score--excellent' : score >= SCORE_THRESHOLDS.acceptable ? 'score--ok' : 'score--poor';
}
