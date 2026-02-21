import { $, esc } from './utils.js';
import { state } from './state.js';
import { duckSay } from './duck.js';
import { playQuack } from './sound.js';
import { scheduleSave } from './draft.js';

export async function verifyUnderstanding(): Promise<void> {
  if (!state.selectedProvider || !state.authToken) return;
  const raw = ($('rawTaskField') as HTMLTextAreaElement).value.trim();
  const ask = ($('askField') as HTMLTextAreaElement).value.trim();
  if (!raw || !ask) { duckSay("Paste the original AND write your understanding first."); return; }
  const loading = $('verifyLoading'), result = $('verifyResult');
  loading.classList.add('active'); result.classList.remove('visible'); result.className = 'verify-result';
  ($('verifyBtn') as HTMLButtonElement).disabled = true;
  try {
    const r = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.authToken}` },
      body: JSON.stringify({
        provider: state.selectedProvider, model: state.selectedModel,
        original: raw, rewrite: ask,
        deliverable: ($('deliverableField') as HTMLTextAreaElement).value,
        notAsked: ($('notAskedField') as HTMLTextAreaElement).value,
        definitionOfDone: ($('dodField') as HTMLTextAreaElement).value
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
    if (p.scope_drift?.detected) html += `<div class="vr-section"><div class="vr-section-title">Scope Drift</div><ul class="vr-items">${(p.scope_drift.items || []).slice(0, 4).map((i: string) => '<li>' + esc(i) + '</li>').join('')}</ul></div>`;
    if (p.missing_items?.detected) html += `<div class="vr-section"><div class="vr-section-title">Missing from Original</div><ul class="vr-items">${(p.missing_items.items || []).slice(0, 4).map((i: string) => '<li>' + esc(i) + '</li>').join('')}</ul></div>`;
    if (p.assumptions?.detected) html += `<div class="vr-section"><div class="vr-section-title">Assumptions</div><ul class="vr-items">${(p.assumptions.items || []).slice(0, 4).map((i: string) => '<li>' + esc(i) + '</li>').join('')}</ul></div>`;
    if (p.definition_of_done && !p.definition_of_done.clear) html += `<div class="vr-section"><div class="vr-section-title">Definition of Done</div><p style="font-size:.82rem">${esc(p.definition_of_done.suggestion || 'Make it specific and testable')}</p></div>`;
    if (p.spelling_grammar?.issues?.length) html += `<div class="vr-section"><div class="vr-section-title">Spelling/Grammar</div><ul class="vr-items">${p.spelling_grammar.issues.slice(0, 4).map((i: string) => '<li>' + esc(i) + '</li>').join('')}</ul></div>`;
    if (p.suggestions?.length) html += `<div class="vr-section"><div class="vr-section-title">Suggestions</div><ul class="vr-items">${p.suggestions.slice(0, 4).map((i: string) => '<li>' + esc(i) + '</li>').join('')}</ul></div>`;
    if (p.duck_quote) html += `<div class="vr-duck-quote">🦆 "${esc(p.duck_quote)}"</div>`;
    if (d.masking?.itemsMasked) html += `<div class="vr-masking">🔒 ${d.masking.itemsMasked} sensitive item(s) masked before sending to ${d.provider}</div>`;
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
      $('verifyBtn').textContent = '🦆 Re-verify';
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
  const raw = ($('rawTaskField') as HTMLTextAreaElement).value.trim();
  const ask = ($('askField') as HTMLTextAreaElement).value.trim();
  if (!raw || !ask) { duckSay("Need both original and your rewrite to suggest a re-scope."); return; }
  const loading = $('rescopeLoading'), section = $('rescopeSection');
  loading.classList.add('active'); section.classList.remove('visible');
  const vrEl = $('verifyResult');
  const driftSummary = vrEl ? vrEl.textContent!.substring(0, 500) : 'Drift detected';
  try {
    const r = await fetch('/api/rescope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.authToken}` },
      body: JSON.stringify({
        provider: state.selectedProvider, model: state.selectedModel,
        original: raw, rewrite: ask,
        dod: ($('dodField') as HTMLTextAreaElement).value, driftSummary
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Re-scope failed');
    const p = d.result;
    if (!p) throw new Error('No suggestion returned');
    ($('rescopeRewrite') as HTMLTextAreaElement).value = p.corrected_rewrite || '';
    ($('rescopeDod') as HTMLTextAreaElement).value = p.corrected_dod || '';
    $('rescopeChanges').innerHTML = (p.changes_made || []).map((c: string) => `<li>${esc(c)}</li>`).join('');
    $('rescopeDuck').textContent = p.duck_quote ? `🦆 "${p.duck_quote}"` : '';
    section.classList.add('visible');
    duckSay("Here's my suggestion. Review it — don't blindly accept!");
  } catch (e) {
    duckSay('Re-scope error: ' + (e as Error).message);
  } finally {
    loading.classList.remove('active');
  }
}

export function applyRescope(field: string): void {
  if (field === 'rewrite') {
    ($('askField') as HTMLTextAreaElement).value = ($('rescopeRewrite') as HTMLTextAreaElement).value;
    duckSay("Rewrite updated. Re-verify to confirm it matches now.");
  } else if (field === 'dod') {
    ($('dodField') as HTMLTextAreaElement).value = ($('rescopeDod') as HTMLTextAreaElement).value;
    duckSay("Definition of Done updated. Re-verify!");
  }
  playQuack(); scheduleSave();
}

export function hideRescope(): void {
  $('rescopeSection').classList.remove('visible');
}
