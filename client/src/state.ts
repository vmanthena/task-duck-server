import { STORAGE_KEYS } from '../../shared/constants.js';

export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  cost: string;
}

export interface DiffItem {
  text: string;
  minutes: number;
  status: string;
  type: string;
  idx?: number;
}

export interface VerificationHistoryEntry {
  attempt: number;
  verdict: string;
  confidence: number;
  timestamp: string;
  summary: string;
  fullHtml: string;
}

export const state = {
  authToken: localStorage.getItem(STORAGE_KEYS.token) ?? '',
  selectedProvider: localStorage.getItem(STORAGE_KEYS.provider) ?? '',
  selectedModel: localStorage.getItem(STORAGE_KEYS.model) ?? '',
  availableProviders: [] as ProviderInfo[],
  currentStep: 1,
  verifyAttempts: 0,
  lastVerdict: null as string | null,
  workTimerInterval: null as ReturnType<typeof setInterval> | null,
  workTimerSeconds: 0,
  workTimerPaused: false,
  checkpointInterval: null as ReturnType<typeof setInterval> | null,
  amendments: [] as DiffItem[],
  extras: [] as DiffItem[],
  diffItems: [] as DiffItem[],
  soundEnabled: localStorage.getItem(STORAGE_KEYS.sound) === 'true',
  clientLockoutUntil: parseInt(localStorage.getItem(STORAGE_KEYS.lockout) ?? '0'),
  lockoutTimer: null as ReturnType<typeof setTimeout> | null,
  onboarded: localStorage.getItem(STORAGE_KEYS.onboarded) === 'true',
  verificationHistory: [] as VerificationHistoryEntry[],
  totalPlannedMinutes: 0,
  compareMode: false,
  vrCollapsed: new Set<string>(),
  theme: (localStorage.getItem(STORAGE_KEYS.theme) || 'dark') as 'dark' | 'light',
  volume: parseInt(localStorage.getItem(STORAGE_KEYS.volume) ?? '60'),
};
