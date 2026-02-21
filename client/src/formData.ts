import { $ } from './utils.js';

export const FORM_FIELDS = {
  taskId: 'taskIdField',
  title: 'taskTitleField',
  raw: 'rawTaskField',
  ask: 'askField',
  deliverable: 'deliverableField',
  dod: 'dodField',
  notAsked: 'notAskedField',
  approach: 'approachField',
  peerWho: 'peerWho',
  peerSurprise: 'peerSurprise',
  parkingLot: 'parkingLot',
  storyPoints: 'storyPointsField',
  driftReason: 'driftReason',
  rescopeJustification: 'rescopeJustification',
} as const;

export type FormData = Record<keyof typeof FORM_FIELDS, string>;

export function gatherFormData(): FormData {
  const data = {} as FormData;
  for (const [key, id] of Object.entries(FORM_FIELDS)) {
    data[key as keyof FormData] = ($(id) as HTMLInputElement | HTMLTextAreaElement).value;
  }
  return data;
}

export function setFormData(data: Partial<FormData>): void {
  for (const [key, value] of Object.entries(data)) {
    const id = FORM_FIELDS[key as keyof typeof FORM_FIELDS];
    if (id && value != null) {
      ($(id) as HTMLInputElement | HTMLTextAreaElement).value = value;
    }
  }
}

export function clearFormData(): void {
  for (const id of Object.values(FORM_FIELDS)) {
    ($(id) as HTMLInputElement | HTMLTextAreaElement).value = '';
  }
}
