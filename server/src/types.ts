export interface VerifyResult {
  verdict: 'match' | 'drift' | 'missing' | 'major_mismatch' | 'error';
  confidence: number;
  summary: string;
  scope_drift?: { detected: boolean; items: string[] };
  missing_items?: { detected: boolean; items: string[] };
  assumptions?: { detected: boolean; items: string[] };
  definition_of_done?: { clear: boolean; suggestion: string };
  spelling_grammar?: { issues: string[] };
  suggestions?: string[];
  story_points?: { provided: number | null; assessment: string; suggested: number | null; bloated: boolean; split_recommended: boolean };
  duck_quote?: string;
  intent_match?: { detail: string };
}

export interface RescopeResult {
  corrected_rewrite: string;
  corrected_dod: string;
  changes_made: string[];
  suggested_story_points?: number | null;
  duck_quote?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  cost: 'free' | 'low' | 'medium';
}

export type LLMCallFn = (systemPrompt: string, userPrompt: string, modelOverride?: string) => Promise<string>;

export interface MaskingReport {
  original: string;
  placeholder: string;
}
