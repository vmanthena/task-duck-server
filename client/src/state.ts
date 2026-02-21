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
};
