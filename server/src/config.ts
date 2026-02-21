import crypto from 'crypto';
import { createLogger, configureLogger, type LogLevel } from '../../shared/logger.js';
import { BCRYPT } from '../../shared/constants.js';

function cleanEnv(key: string): string {
  return (process.env[key] || '').replace(/^["']|["']$/g, '').trim();
}

export const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as LogLevel;
export const PORT = process.env.PORT || 8080;
export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
export const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '24');

export const PASSWORD_VERIFIER = cleanEnv('PASSWORD_VERIFIER');
export const BCRYPT_SALT = cleanEnv('BCRYPT_SALT');
export const BCRYPT_COST = Math.max(BCRYPT.minCost, Math.min(parseInt(process.env.BCRYPT_COST || String(BCRYPT.minCost)), BCRYPT.maxCost));

export const ANTHROPIC_API_KEY = cleanEnv('ANTHROPIC_API_KEY');
export const OPENAI_API_KEY = cleanEnv('OPENAI_API_KEY');
export const GEMINI_API_KEY = cleanEnv('GEMINI_API_KEY');

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';

export const OLLAMA_BASE_URL = cleanEnv('OLLAMA_BASE_URL') || 'http://localhost:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
export let ollamaAvailable = false;

export const CUSTOM_MASKS_RAW = process.env.CUSTOM_MASKS || '';

// Initialize server-side logger
configureLogger({ level: LOG_LEVEL, server: true });

const log = createLogger('config');

export function printDiagnostics(): void {
  if (ANTHROPIC_API_KEY) {
    if (!ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
      log.warn('ANTHROPIC_API_KEY does not start with sk-ant- — check .env format (no quotes!)');
    } else {
      log.info(`Anthropic key loaded (${ANTHROPIC_API_KEY.substring(0, 10)}...${ANTHROPIC_API_KEY.substring(ANTHROPIC_API_KEY.length - 4)}, ${ANTHROPIC_API_KEY.length} chars)`);
    }
  }
  if (OPENAI_API_KEY) log.info(`OpenAI key loaded (${OPENAI_API_KEY.substring(0, 7)}..., ${OPENAI_API_KEY.length} chars)`);
  if (GEMINI_API_KEY) log.info(`Gemini key loaded (${GEMINI_API_KEY.substring(0, 7)}..., ${GEMINI_API_KEY.length} chars)`);
  if (!PASSWORD_VERIFIER) log.warn('PASSWORD_VERIFIER not set! Run: npm run hash');
  if (!BCRYPT_SALT) log.warn('BCRYPT_SALT not set! Run: npm run hash -- --gen-salt');
  const rawCost = parseInt(process.env.BCRYPT_COST || String(BCRYPT.minCost));
  if (rawCost < BCRYPT.minCost) {
    log.warn(`BCRYPT_COST=${process.env.BCRYPT_COST} is too low! Minimum is ${BCRYPT.minCost}. Enforced: BCRYPT_COST=${BCRYPT_COST}`);
  }
  if (rawCost > BCRYPT.maxCost) {
    log.warn(`BCRYPT_COST=${process.env.BCRYPT_COST} is too high! Capped at ${BCRYPT.maxCost}. Enforced: BCRYPT_COST=${BCRYPT_COST}`);
  }
  if (BCRYPT_SALT) {
    const m = BCRYPT_SALT.match(/^\$2[aby]?\$(\d+)\$/);
    if (m && parseInt(m[1]) < BCRYPT.minCost) {
      log.warn(`BCRYPT_SALT encodes cost ${m[1]}! Minimum is ${BCRYPT.minCost}. Regenerate: BCRYPT_COST=${BCRYPT.minCost} npm run hash`);
    }
  }
}

export async function probeOllama(): Promise<void> {
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      ollamaAvailable = true;
      log.info(`Ollama detected at ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL})`);
    }
  } catch {
    log.debug(`Ollama not available at ${OLLAMA_BASE_URL}`);
  }
}
