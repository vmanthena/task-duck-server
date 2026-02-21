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
  authToken: localStorage.getItem('tdToken') || '',
  selectedProvider: localStorage.getItem('tdProvider') || '',
  selectedModel: localStorage.getItem('tdModel') || '',
  availableProviders: [] as ProviderInfo[],
  currentStep: 1,
  verifyAttempts: 0,
  lastVerdict: null as string | null,
  workTimerInterval: null as ReturnType<typeof setInterval> | null,
  workTimerSeconds: 0,
  workTimerPaused: false,
  checkpointInterval: null as ReturnType<typeof setInterval> | null,
  draftId: localStorage.getItem('tdDraftId') || null,
  amendments: [] as DiffItem[],
  extras: [] as DiffItem[],
  diffItems: [] as DiffItem[],
  soundEnabled: localStorage.getItem('tdSound') === 'true',
  clientLockoutUntil: parseInt(localStorage.getItem('tdLockout') || '0'),
  lockoutTimer: null as ReturnType<typeof setTimeout> | null,
};
