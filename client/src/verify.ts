import { $, esc } from './utils.js';
import { state } from './state.js';
import { duckSay } from './duck.js';
import { playQuack } from './sound.js';
import { scheduleSave } from './draft.js';
import { ICON, ICON_SM } from './icons.js';
import { API_PATHS } from '../../shared/constants.js';

const VERIFY_BTN_HTML = `${ICON.checkCircle} Verify`;
const REVERIFY_BTN_HTML = `${ICON.checkCircle} Re-verify`;

function vrSectionKey(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '_');
}

function renderVrSection(title: string, items: string[]): string {
  const key = vrSectionKey(title);
  const collapsed = state.vrCollapsed.has(key) ? ' collapsed' : '';
  return `<div class="vr-collapsible${collapsed}" onclick="toggleVrCollapse('${key}')"><div class="vr-section"><div class="vr-section-title">${esc(title)}</div><div class="vr-collapse-body"><ul class="vr-items">${items.slice(0, 4).map(i => '<li>' + esc(i) + '</li>').join('')}</ul></div></div></div>`;
}

export function toggleVrCollapse(key: string): void {
  if (state.vrCollapsed.has(key)) state.vrCollapsed.delete(key);
  else state.vrCollapsed.add(key);
  const el = document.querySelector(`.vr-collapsible[onclick*="'${key}'"]`);
  if (el) el.classList.toggle('collapsed');
}

export function toggleCompareMode(): void {
  state.compareMode = !state.compareMode;
  const el = $('compareProviderWrap');
  if (el) el.style.display = state.compareMode ? 'inline-flex' : 'none';
}

async function singleVerify(provider: string, model: string): Promise<{ result: unknown; masking?: unknown; provider?: string; error?: string }> {
  const raw = ($('rawTaskField') as HTMLTextAreaElement).value.trim();
  const ask = ($('askField') as HTMLTextAreaElement).value.trim();
  const spVal = parseInt(($('storyPointsField') as HTMLInputElement).value);
  const storyPoints = isNaN(spVal) ? null : spVal;
  const r = await fetch(API_PATHS.verify, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.authToken}` },
    body: JSON.stringify({
      provider, model,
      original: raw, rewrite: ask,
      deliverable: ($('deliverableField') as HTMLTextAreaElement).value,
      notAsked: ($('notAskedField') as HTMLTextAreaElement).value,
      definitionOfDone: ($('dodField') as HTMLTextAreaElement).value,
      storyPoints
    })
  });
  return r.json();
}

function renderVerifyResult(d: { result: Record<string, unknown>; masking?: { itemsMasked?: number }; provider?: string }): string {
  const p = d.result as Record<string, unknown>;
  let html = `<div class="vr-header"><span class="vr-verdict vr-verdict-${p.verdict}">${p.verdict}</span><span class="vr-confidence">${Math.round(((p.confidence as number) || 0) * 100)}%</span></div>`;
  html += `<div class="vr-summary">${esc((p.summary as string) || '')}</div>`;
  const drift = p.scope_drift as { detected?: boolean; items?: string[] } | undefined;
  if (drift?.detected) html += renderVrSection('Scope Drift', drift.items || []);
  const missing = p.missing_items as { detected?: boolean; items?: string[] } | undefined;
  if (missing?.detected) html += renderVrSection('Missing from Original', missing.items || []);
  const assumptions = p.assumptions as { detected?: boolean; items?: string[] } | undefined;
  if (assumptions?.detected) html += renderVrSection('Assumptions', assumptions.items || []);
  const dodCheck = p.definition_of_done as { clear?: boolean; suggestion?: string } | undefined;
  if (dodCheck && !dodCheck.clear) html += `<div class="vr-section"><div class="vr-section-title">Definition of Done</div><p style="font-size:.82rem">${esc(dodCheck.suggestion || 'Make it specific and testable')}</p></div>`;
  const spelling = p.spelling_grammar as { issues?: string[] } | undefined;
  if (spelling?.issues?.length) html += renderVrSection('Spelling/Grammar', spelling.issues);
  const suggestions = p.suggestions as string[] | undefined;
  if (suggestions?.length) html += renderVrSection('Suggestions', suggestions);
  if (p.duck_quote) html += `<div class="vr-duck-quote">🦆 "${esc(p.duck_quote as string)}"</div>`;
  if (d.masking?.itemsMasked) html += `<div class="vr-masking">${ICON.lock} ${d.masking.itemsMasked} sensitive item(s) masked before sending to ${d.provider}</div>`;
  return html;
}

const VERDICT_SEVERITY: Record<string, number> = { match: 0, drift: 1, missing: 2, major_mismatch: 3 };

function moreConservativeVerdict(a: string, b: string): string {
  return (VERDICT_SEVERITY[a] ?? 3) >= (VERDICT_SEVERITY[b] ?? 3) ? a : b;
}

export async function verifyUnderstanding(): Promise<void> {
  if (!state.selectedProvider || !state.authToken) return;
  const raw = ($('rawTaskField') as HTMLTextAreaElement).value.trim();
  const ask = ($('askField') as HTMLTextAreaElement).value.trim();
  if (!raw || !ask) { duckSay("Paste the original AND write your understanding first."); return; }
  const loading = $('verifyLoading'), result = $('verifyResult');
  loading.classList.add('active'); result.classList.remove('visible'); result.className = 'verify-result';
  ($('verifyBtn') as HTMLButtonElement).disabled = true;

  // Comparison mode: two parallel calls
  if (state.compareMode) {
    const sel2 = $('compareProviderSelect') as HTMLSelectElement | null;
    const idx2 = sel2 ? parseInt(sel2.value) : -1;
    const p2 = state.availableProviders[idx2];
    if (!p2) { duckSay("Select a second provider for comparison."); loading.classList.remove('active'); ($('verifyBtn') as HTMLButtonElement).disabled = false; return; }
    try {
      const [d1, d2] = await Promise.all([
        singleVerify(state.selectedProvider, state.selectedModel),
        singleVerify(p2.id, p2.model),
      ]);
      const r1 = d1.result as Record<string, unknown> | undefined;
      const r2 = d2.result as Record<string, unknown> | undefined;
      if (!r1 || !r2) throw new Error('One or both providers failed');
      const v1 = (r1.verdict as string) || 'error';
      const v2 = (r2.verdict as string) || 'error';
      state.lastVerdict = moreConservativeVerdict(v1, v2);
      state.verifyAttempts++;
      const html1 = renderVerifyResult(d1 as { result: Record<string, unknown>; masking?: { itemsMasked?: number }; provider?: string });
      const html2 = renderVerifyResult(d2 as { result: Record<string, unknown>; masking?: { itemsMasked?: number }; provider?: string });
      const p1Name = state.availableProviders.find(p => p.id === state.selectedProvider)?.name || state.selectedProvider;
      result.innerHTML = `<div class="compare-results"><div class="compare-col"><div class="compare-label">${esc(p1Name)}</div>${html1}</div><div class="compare-col"><div class="compare-label">${esc(p2.name)}</div>${html2}</div></div>`;
      result.className = `verify-result visible verdict-${state.lastVerdict}`;
      const confidencePct = Math.round((Math.min((r1.confidence as number) || 0, (r2.confidence as number) || 0)) * 100);
      state.verificationHistory.push({ attempt: state.verifyAttempts, verdict: state.lastVerdict, confidence: confidencePct, timestamp: new Date().toISOString(), summary: `Compare: ${v1} vs ${v2}`, fullHtml: result.innerHTML });
      renderVerificationHistory();
      if (state.lastVerdict === 'match') { duckSay("Both providers agree — clean match!"); $('driftOverride').classList.remove('visible'); }
      else { playQuack(); duckSay("Drift detected by at least one provider."); $('driftOverride').classList.add('visible'); $('verifyBtn').innerHTML = REVERIFY_BTN_HTML; }
    } catch (e) {
      duckSay('Compare error: ' + (e as Error).message);
      result.innerHTML = `<p style="color:var(--red);font-size:.85rem">${esc((e as Error).message)}</p>`;
      result.className = 'verify-result visible verdict-major_mismatch';
    } finally {
      loading.classList.remove('active');
      ($('verifyBtn') as HTMLButtonElement).disabled = false;
    }
    return;
  }

  // Normal single-provider verify
  try {
    const d = await singleVerify(state.selectedProvider, state.selectedModel);
    const p = d.result as Record<string, unknown>;
    if (!p) throw new Error((d.error as string) || 'No response from AI provider');
    if (p.verdict === 'error') {
      result.innerHTML = `<div class="vr-header"><span class="vr-verdict" style="background:var(--red);color:#fff">ERROR</span></div><div class="vr-summary" style="color:var(--red)">${esc((p.summary as string) || (d.error as string) || 'Unknown error')}</div>${p.duck_quote ? `<div class="vr-duck-quote">🦆 "${esc(p.duck_quote as string)}"</div>` : ''}`;
      result.className = 'verify-result visible verdict-major_mismatch';
      duckSay((d.error as string) || 'Verification failed. Try again or switch providers.');
      return;
    }
    state.lastVerdict = p.verdict as string; state.verifyAttempts++;
    const confidencePct = Math.round(((p.confidence as number) || 0) * 100);
    const html = renderVerifyResult(d as { result: Record<string, unknown>; masking?: { itemsMasked?: number }; provider?: string });
    // Story points (only in non-compare mode since renderVerifyResult doesn't handle it)
    let spHtml = '';
    const sp = p.story_points as { bloated?: boolean; assessment?: string; suggested?: number; provided?: number; split_recommended?: boolean } | undefined;
    if (sp) {
      const badge = sp.bloated
        ? `<span class="vr-sp-badge vr-sp-bloated">${ICON_SM.alertTriangle} BLOATED</span>`
        : `<span class="vr-sp-badge vr-sp-ok">${ICON_SM.check} OK</span>`;
      spHtml += `<div class="vr-story-points"><div class="vr-section-title">Story Points</div>`;
      spHtml += `<div class="vr-sp-assessment">${badge} ${esc(sp.assessment || '')}</div>`;
      if (sp.suggested != null) spHtml += `<div style="font-family:var(--mono);font-size:.75rem;color:var(--text-dim)">Suggested: ${sp.suggested} SP${sp.provided != null ? ` (provided: ${sp.provided})` : ''}</div>`;
      if (sp.split_recommended) spHtml += `<div class="vr-sp-split">${ICON_SM.scissors} Consider splitting this story — 8+ SP is too large for a single sprint</div>`;
      spHtml += `</div>`;
    }
    result.innerHTML = html + spHtml; result.className = `verify-result visible verdict-${p.verdict}`;
    state.verificationHistory.push({ attempt: state.verifyAttempts, verdict: p.verdict as string, confidence: confidencePct, timestamp: new Date().toISOString(), summary: (p.summary as string) || '', fullHtml: html + spHtml });
    renderVerificationHistory();
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

function renderVerificationHistory(): void {
  const el = $('verificationHistory');
  if (!el || !state.verificationHistory.length) return;
  el.innerHTML = '<div class="vh-title">Verification History</div>' +
    state.verificationHistory.map((entry, i) =>
      `<div class="vh-entry" onclick="toggleVhEntry(${i})"><div class="vh-entry-header"><span class="vr-verdict vr-verdict-${entry.verdict}">${entry.verdict}</span><span class="vr-confidence">${entry.confidence}%</span><span class="vh-time">#${entry.attempt} — ${new Date(entry.timestamp).toLocaleTimeString()}</span></div><div class="vh-entry-body">${entry.fullHtml}</div></div>`
    ).join('');
}

export function toggleVhEntry(idx: number): void {
  const entries = document.querySelectorAll('.vh-entry');
  if (entries[idx]) entries[idx].classList.toggle('expanded');
}
