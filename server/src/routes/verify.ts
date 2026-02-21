import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CUSTOM_MASKS_RAW } from '../config.js';
import { DataMasker } from '../services/dataMasker.js';
import { providers, getProviderKey } from '../services/llmService.js';
import { SYS_PROMPT, USR_TMPL } from '../prompts/verify.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('verify');

const router = Router();

router.post('/api/verify', requireAuth, async (req, res) => {
  const { provider, original, rewrite, deliverable, notAsked, definitionOfDone, model } = req.body;
  if (!provider || !original || !rewrite) {
    res.status(400).json({ error: 'Missing fields: need provider, original, and rewrite' });
    return;
  }
  if (!providers[provider]) {
    res.status(400).json({ error: `Unknown provider: ${provider}` });
    return;
  }
  const key = getProviderKey(provider);
  if (!key) {
    res.status(400).json({ error: `${provider} not configured — add API key to .env` });
    return;
  }
  try {
    const m = new DataMasker(CUSTOM_MASKS_RAW);
    const up = USR_TMPL
      .replace('{ORIGINAL}', m.mask(original))
      .replace('{REWRITE}', m.mask(rewrite))
      .replace('{DELIVERABLE}', m.mask(deliverable || '') || '(none)')
      .replace('{DOD}', m.mask(definitionOfDone || '') || '(not specified)')
      .replace('{NOT_ASKED}', m.mask(notAsked || '') || '(none)');

    const raw = await providers[provider](SYS_PROMPT, up, model);

    if (!raw || !raw.trim()) {
      throw new Error(`${provider} returned an empty response. Try again.`);
    }

    // Parse JSON — strip markdown fences and any preamble
    let p;
    try {
      let cleaned = raw.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      p = JSON.parse(cleaned);
    } catch {
      log.error(`JSON parse failed for ${provider}`, raw.substring(0, 500));
      p = {
        verdict: 'error',
        confidence: 0,
        summary: `${provider} returned a response that couldn't be parsed as JSON. Try a different provider or re-verify.`,
        duck_quote: "Even ducks have bad days. Try again! 🦆"
      };
    }

    // Unmask any sensitive data in response
    const um = (o: Record<string, unknown> | undefined, k: string) => {
      if (!o?.[k]) return;
      const val = o[k];
      if (Array.isArray(val)) o[k] = val.map((i: string) => m.unmask(i));
      else if (typeof val === 'string') o[k] = m.unmask(val);
    };
    um(p.scope_drift, 'items');
    um(p.missing_items, 'items');
    um(p.assumptions, 'items');
    um(p, 'suggestions');
    um(p, 'summary');
    um(p, 'duck_quote');
    um(p?.intent_match, 'detail');
    um(p?.definition_of_done, 'suggestion');
    if (p?.spelling_grammar?.issues) p.spelling_grammar.issues = p.spelling_grammar.issues.map((i: string) => m.unmask(i));

    res.json({ result: p, masking: { itemsMasked: m.map.size, report: m.report() }, provider });
  } catch (e) {
    const msg = (e as Error).message;
    log.error(`${provider}: ${msg}`);
    res.status(500).json({
      error: msg,
      result: {
        verdict: 'error',
        confidence: 0,
        summary: msg,
        duck_quote: "Something went wrong. Try again or switch providers. 🦆"
      }
    });
  }
});

export default router;
