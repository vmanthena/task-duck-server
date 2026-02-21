import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CUSTOM_MASKS_RAW } from '../config.js';
import { DataMasker } from '../services/dataMasker.js';
import { providers, getProviderKey } from '../services/llmService.js';
import { RESCOPE_PROMPT, RESCOPE_USR } from '../prompts/rescope.js';
import { repairJSON } from '../services/jsonRepair.js';
import { createLogger } from '../../../shared/logger.js';

const log = createLogger('rescope');

const router = Router();

router.post('/api/rescope', requireAuth, async (req, res) => {
  const { provider, model, original, rewrite, dod, driftSummary, justification, storyPoints } = req.body;
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
    const up = RESCOPE_USR
      .replace('{ORIGINAL}', m.mask(original))
      .replace('{REWRITE}', m.mask(rewrite))
      .replace('{DOD}', m.mask(dod || '') || '(not specified)')
      .replace('{DRIFT_SUMMARY}', m.mask(driftSummary || '') || '(none)')
      .replace('{JUSTIFICATION}', m.mask(justification || '') || '(none provided)')
      .replace('{STORY_POINTS}', storyPoints ? String(storyPoints) : '(not provided)');
    const raw = await providers[provider](RESCOPE_PROMPT, up, model);
    if (!raw || !raw.trim()) throw new Error(`${provider} returned empty response`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p: Record<string, any>;
    const repaired = repairJSON(raw);
    if (repaired) {
      p = repaired;
    } else {
      log.error(`JSON parse failed for ${provider}`, raw.substring(0, 500));
      p = { corrected_rewrite: '', corrected_dod: '', changes_made: ['Could not parse AI response'], suggested_story_points: null, duck_quote: 'Try again!' };
    }
    // Unmask
    if (p.corrected_rewrite) p.corrected_rewrite = m.unmask(p.corrected_rewrite);
    if (p.corrected_dod) p.corrected_dod = m.unmask(p.corrected_dod);
    if (p.changes_made) p.changes_made = p.changes_made.map((i: string) => m.unmask(i));
    if (p.duck_quote) p.duck_quote = m.unmask(p.duck_quote);
    res.json({ result: p, provider });
  } catch (e) {
    const msg = (e as Error).message;
    log.error(`${provider}: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

export default router;
