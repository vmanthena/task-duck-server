// Single source of truth for values shared between server and client

export const VERSION = '4.0.0';

export const API_PATHS = {
  health: '/api/health',
  challenge: '/api/auth/challenge',
  login: '/api/auth/login',
  providers: '/api/providers',
  verify: '/api/verify',
  rescope: '/api/rescope',
} as const;

export const AUTH = {
  maxAttempts: 3,
  lockoutMs: 20 * 60 * 1000,
  nonceTtlMs: 60_000,
} as const;

export const LIMITS = {
  bodyMaxKb: 50,
  stringMaxLen: 10_000,
  llmMaxTokens: 16_384,
} as const;

export const SCORE_THRESHOLDS = {
  excellent: 80,
  acceptable: 50,
  extraPenalty: 10,
} as const;

export const BCRYPT = {
  minCost: 15,
  maxCost: 16,
} as const;

export const RETRY = {
  baseMs: 2000,
  maxMs: 15_000,
  attempts: 3,
} as const;

export const TIMERS = {
  draftDebounceMs: 5_000,
  creepAlertMs: 6_000,
  checkpointMs: 30 * 60 * 1000,
  autosaveFlashMs: 1_500,
} as const;

export const STORAGE_KEYS = {
  token: 'tdToken',
  provider: 'tdProvider',
  model: 'tdModel',
  lockout: 'tdLockout',
  draft: 'tdDraft',
  history: 'tdHistory',
  sound: 'tdSound',
  onboarded: 'tdOnboarded',
  streak: 'tdStreak',
  lastTaskDate: 'tdLastTaskDate',
  theme: 'tdTheme',
  volume: 'tdVolume',
} as const;
