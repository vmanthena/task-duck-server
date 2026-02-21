import 'dotenv/config';
import { createApp } from './app.js';
import { PORT, ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_MODEL, CUSTOM_MASKS_RAW, ollamaAvailable, OLLAMA_MODEL, printDiagnostics, probeOllama } from './config.js';
import { hasAnyApiKey } from './services/llmService.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('server');

printDiagnostics();
await probeOllama();

const app = createApp();

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  log.info(`Task Duck v4.0.0 — port ${PORT}`);
  log.info(`Auth: ${process.env.PASSWORD_VERIFIER ? 'bcrypt challenge-response' : 'Open (no password)'}`);
  log.info(`Providers: ${[
    ANTHROPIC_API_KEY ? 'Claude (' + ANTHROPIC_MODEL + ')' : '',
    OPENAI_API_KEY ? 'OpenAI' : '',
    GEMINI_API_KEY ? 'Gemini' : '',
    ollamaAvailable ? 'Ollama (' + OLLAMA_MODEL + ')' : '',
    !hasAnyApiKey() ? 'Mock (Dev)' : '',
  ].filter(Boolean).join(' | ')}`);
  log.info(`Masking: ${CUSTOM_MASKS_RAW ? `${CUSTOM_MASKS_RAW.split(',').length} custom` : 'Auto'}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EACCES') log.error(`Port ${PORT} denied`);
  else if (err.code === 'EADDRINUSE') log.error(`Port ${PORT} in use`);
  else log.error(err.message);
  process.exit(1);
});
