import { $, esc } from './utils.js';
import { state } from './state.js';
import { duckSay } from './duck.js';
import { playQuack } from './sound.js';
import { scheduleSave } from './draft.js';
import { ICON, ICON_SM } from './icons.js';
import { API_PATHS } from '../../shared/constants.js';

const VERIFY_BTN_HTML = `${ICON.checkCircle} Verify`;
const REVERIFY_BTN_HTML = `${ICON.checkCircle} Re-verify`;

function renderVrSection(title: string, items: string[]): string {
  return `<div class="vr-section"><div class="vr-section-title">${esc(title)}</div><ul class="vr-items">${items.slice(0, 4).map(i => '<li>' + esc(i) + '</li>').join('')}</ul></div>`;
}

export async function verifyUnderstanding(): Promise<void> {
  if (!state.selectedProvider || !state.authToken) return;
  const raw = ($('rawTaskField') as HTMLTextAreaElement).value.trim();
  const ask = ($('askField') as HTMLTextAreaElement).value.trim();
  if (!raw || !ask) { duckSay("Paste the original AND write your understanding first."); return; }
  const loading = $('verifyLoading'), result = $('verifyResult');
  loading.classList.add('active'); result.classList.remove('visible'); result.className = 'verify-result';
  ($('verifyBtn') as HTMLButtonElement).disabled = true;
  const spVal = parseInt(($('storyPointsField') as HTMLInputElement).value);
  const storyPoints = isNaN(spVal) ? null : spVal;
  try {
    const r = await fetch(API_PATHS.verify, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.authToken}` },
      body: JSON.stringify({
        provider: state.selectedProvider, model: state.selectedModel,
        original: raw, rewrite: ask,
        deliverable: ($('deliverableField') as HTMLTextAreaElement).value,
        notAsked: ($('notAskedField') as HTMLTextAreaElement).value,
        definitionOfDone: ($('dodField') as HTMLTextAreaElement).value,
        storyPoints
      })
    });
    const d = await r.json();
    const p = d.result;
    if (!p) throw new Error(d.error || 'No response from AI provider');
    if (p.verdict === 'error') {
      result.innerHTML = `<div class="vr-header"><span class="vr-verdict" style="background:var(--red);color:#fff">ERROR</span></div><div class="vr-summary" style="color:var(--red)">${esc(p.summary || d.error || 'Unknown error')}</div>${p.duck_quote ? `<div class="vr-duck-quote">🦆 "${esc(p.duck_quote)}"</div>` : ''}`;
      result.className = 'verify-result visible verdict-major_mismatch';
      duckSay(d.error || 'Verification failed. Try again or switch providers.');
      return;
    }
    state.lastVerdict = p.verdict; state.verifyAttempts++;
    let html = `<div class="vr-header"><span class="vr-verdict vr-verdict-${p.verdict}">${p.verdict}</span><span class="vr-confidence">${Math.round((p.confidence || 0) * 100)}%</span></div>`;
    html += `<div class="vr-summary">${esc(p.summary || '')}</div>`;
    if (p.scope_drift?.detected) html += renderVrSection('Scope Drift', p.scope_drift.items || []);
    if (p.missing_items?.detected) html += renderVrSection('Missing from Original', p.missing_items.items || []);
    if (p.assumptions?.detected) html += renderVrSection('Assumptions', p.assumptions.items || []);
    if (p.definition_of_done && !p.definition_of_done.clear) html += `<div class="vr-section"><div class="vr-section-title">Definition of Done</div><p style="font-size:.82rem">${esc(p.definition_of_done.suggestion || 'Make it specific and testable')}</p></div>`;
    if (p.spelling_grammar?.issues?.length) html += renderVrSection('Spelling/Grammar', p.spelling_grammar.issues);
    if (p.suggestions?.length) html += renderVrSection('Suggestions', p.suggestions);
    if (p.story_points) {
      const sp = p.story_points;
      const badge = sp.bloated
        ? `<span class="vr-sp-badge vr-sp-bloated">${ICON_SM.alertTriangle} BLOATED</span>`
        : `<span class="vr-sp-badge vr-sp-ok">${ICON_SM.check} OK</span>`;
      html += `<div class="vr-story-points"><div class="vr-section-title">Story Points</div>`;
      html += `<div class="vr-sp-assessment">${badge} ${esc(sp.assessment || '')}</div>`;
      if (sp.suggested != null) html += `<div style="font-family:var(--mono);font-size:.75rem;color:var(--text-dim)">Suggested: ${sp.suggested} SP${sp.provided != null ? ` (provided: ${sp.provided})` : ''}</div>`;
      if (sp.split_recommended) html += `<div class="vr-sp-split">${ICON_SM.scissors} Consider splitting this story — 8+ SP is too large for a single sprint</div>`;
      html += `</div>`;
    }
    if (p.duck_quote) html += `<div class="vr-duck-quote">🦆 "${esc(p.duck_quote)}"</div>`;
    if (d.masking?.itemsMasked) html += `<div class="vr-masking">${ICON.lock} ${d.masking.itemsMasked} sensitive item(s) masked before sending to ${d.provider}</div>`;
    result.innerHTML = html; result.className = `verify-result visible verdict-${p.verdict}`;
    if (p.verdict === 'match') {
      duckSay("Clean match! Lock it in.");
      $('driftOverride').classList.remove('visible');
      $('rescopeSection').classList.remove('visible');
    } else {
      playQuack();
      if (state.verifyAttempts >= 2) duckSay("Two misses. Re-read the original from scratch.");
      else duckSay("Drift detected. Fix your rewrite or let me re-scope it.");
      $('driftOverride').classList.add('visible');
      $('verifyBtn').innerHTML = REVERIFY_BTN_HTML;
    }
  } catch (e) {
    duckSay('Verify error: ' + (e as Error).message);
    result.innerHTML = `<p style="color:var(--red);font-size:.85rem">${esc((e as Error).message)}</p><p style="color:var(--text-muted);font-size:.75rem;margin-top:.4rem">Try again or switch to a different AI provider.</p>`;
    result.className = 'verify-result visible verdict-major_mismatch';
  } finally {
    loading.classList.remove('active');
    ($('verifyBtn') as HTMLButtonElement).disabled = false;
  }
}

export async function requestRescope(): Promise<void> {
  if (!state.selectedProvider || !state.authToken) return;
  const justification = ($('rescopeJustification') as HTMLTextAreaElement).value.trim();
  if (!justification) {
    const el = $('rescopeJustification') as HTMLTextAreaElement;
    el.style.borderColor = 'var(--red)';
    setTimeout(() => { el.style.borderColor = ''; }, 2000);
    duckSay("Explain WHY the scope needs to change before I re-evaluate it.");
    playQuack();
    return;
  }
  const raw = ($('rawTaskField') as HTMLTextAreaElement).value.trim();
  const ask = ($('askField') as HTMLTextAreaElement).value.trim();
  if (!raw || !ask) { duckSay("Need both original and your rewrite to re-evaluate scope."); return; }
  const loading = $('rescopeLoading'), section = $('rescopeSection');
  loading.classList.add('active'); section.classList.remove('visible');
  const vrEl = $('verifyResult');
  const driftSummary = vrEl ? vrEl.textContent!.substring(0, 500) : 'Drift detected';
  const spVal = parseInt(($('storyPointsField') as HTMLInputElement).value);
  const storyPoints = isNaN(spVal) ? null : spVal;
  try {
    const r = await fetch(API_PATHS.rescope, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.authToken}` },
      body: JSON.stringify({
        provider: state.selectedProvider, model: state.selectedModel,
        original: raw, rewrite: ask,
        dod: ($('dodField') as HTMLTextAreaElement).value, driftSummary,
        justification, storyPoints
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Re-scope failed');
    const p = d.result;
    if (!p) throw new Error('No suggestion returned');
    $('rescopeRewriteDisplay').textContent = p.corrected_rewrite || '';
    $('rescopeDodDisplay').textContent = p.corrected_dod || '';
    $('rescopeChanges').innerHTML = (p.changes_made || []).map((c: string) => `<li>${esc(c)}</li>`).join('');
    $('rescopeDuck').textContent = p.duck_quote ? `🦆 "${p.duck_quote}"` : '';
    const pointsField = $('rescopePointsField');
    if (p.suggested_story_points != null) {
      const suggested = p.suggested_story_points;
      const display = $('rescopePointsDisplay');
      let spHtml = '';
      if (storyPoints != null) {
        const diff = suggested - storyPoints;
        const arrow = diff < 0 ? '\u2193' : diff > 0 ? '\u2191' : '=';
        const cls = diff < 0 ? 'rescope-sp-lower' : diff > 0 ? 'rescope-sp-higher' : 'rescope-sp-same';
        spHtml = `<span class="rescope-sp-original">${storyPoints} SP</span> <span class="rescope-sp-arrow ${cls}">${arrow}</span> <span class="rescope-sp-suggested ${cls}">${suggested} SP</span> <span class="rescope-sp-diff ${cls}">(${diff > 0 ? '+' : ''}${diff})</span>`;
      } else {
        spHtml = `<span>${suggested} SP</span>`;
      }
      if (p.split_recommended || suggested >= 8) {
        spHtml += ` <span class="rescope-sp-split">${ICON_SM.scissors} Split recommended</span>`;
      }
      display.innerHTML = spHtml;
      pointsField.style.display = '';
    } else {
      pointsField.style.display = 'none';
    }
    section.classList.add('visible');
    duckSay("Here's my re-evaluation. Review it and copy what you need.");
  } catch (e) {
    duckSay('Re-scope error: ' + (e as Error).message);
  } finally {
    loading.classList.remove('active');
  }
}

export function copyRescopeField(field: string): void {
  const el = field === 'rewrite' ? $('rescopeRewriteDisplay') : $('rescopeDodDisplay');
  const text = el.textContent || '';
  if (!text) { duckSay("Nothing to copy."); return; }
  navigator.clipboard.writeText(text).then(() => {
    duckSay(field === 'rewrite' ? "Rewrite copied! Paste it where you need it." : "DoD copied! Paste it where you need it.");
    playQuack();
  }).catch(() => {
    duckSay("Copy failed — try selecting and copying manually.");
  });
}

export function hideRescope(): void {
  $('rescopeSection').classList.remove('visible');
}
