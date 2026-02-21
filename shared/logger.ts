export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

interface LogEntry {
  ts: string;
  level: LogLevel;
  tag: string;
  msg: string;
  data?: unknown;
}

let minLevel: number = LEVELS.info;
let isServer = false;

export function configureLogger(opts: { level?: LogLevel; server?: boolean }): void {
  if (opts.level) minLevel = LEVELS[opts.level] ?? LEVELS.info;
  if (opts.server !== undefined) isServer = opts.server;
}

function emit(level: LogLevel, tag: string, msg: string, data?: unknown): void {
  if (LEVELS[level] < minLevel) return;

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    tag,
    msg,
  };
  if (data !== undefined) entry.data = data;

  if (isServer) {
    const json = JSON.stringify(entry);
    if (level === 'error') process.stderr.write(json + '\n');
    else process.stdout.write(json + '\n');
  } else {
    const fn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : level === 'debug' ? console.debug
      : console.log;
    fn(`[${entry.ts}] [${level.toUpperCase()}] [${tag}]`, msg, ...(data !== undefined ? [data] : []));
  }
}

export function createLogger(tag: string) {
  return {
    debug: (msg: string, data?: unknown) => emit('debug', tag, msg, data),
    info:  (msg: string, data?: unknown) => emit('info', tag, msg, data),
    warn:  (msg: string, data?: unknown) => emit('warn', tag, msg, data),
    error: (msg: string, data?: unknown) => emit('error', tag, msg, data),
  };
}
