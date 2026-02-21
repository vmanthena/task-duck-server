import { describe, it, expect } from 'vitest';
import { SYS_PROMPT, USR_TMPL } from '../../../server/src/prompts/verify.js';
import { RESCOPE_PROMPT, RESCOPE_USR } from '../../../server/src/prompts/rescope.js';

describe('prompts/verify', () => {
  it('SYS_PROMPT contains JSON schema keys', () => {
    expect(SYS_PROMPT).toContain('"verdict"');
    expect(SYS_PROMPT).toContain('"confidence"');
    expect(SYS_PROMPT).toContain('"summary"');
    expect(SYS_PROMPT).toContain('"scope_drift"');
    expect(SYS_PROMPT).toContain('"duck_quote"');
    expect(SYS_PROMPT).toContain('"story_points"');
  });

  it('USR_TMPL has all 6 placeholders', () => {
    expect(USR_TMPL).toContain('{ORIGINAL}');
    expect(USR_TMPL).toContain('{REWRITE}');
    expect(USR_TMPL).toContain('{DELIVERABLE}');
    expect(USR_TMPL).toContain('{DOD}');
    expect(USR_TMPL).toContain('{NOT_ASKED}');
    expect(USR_TMPL).toContain('{STORY_POINTS}');
  });
});

describe('prompts/rescope', () => {
  it('RESCOPE_PROMPT contains "Scope Re-evaluator"', () => {
    expect(RESCOPE_PROMPT).toContain('Scope Re-evaluator');
  });

  it('RESCOPE_USR has all 6 placeholders', () => {
    expect(RESCOPE_USR).toContain('{ORIGINAL}');
    expect(RESCOPE_USR).toContain('{REWRITE}');
    expect(RESCOPE_USR).toContain('{DOD}');
    expect(RESCOPE_USR).toContain('{DRIFT_SUMMARY}');
    expect(RESCOPE_USR).toContain('{JUSTIFICATION}');
    expect(RESCOPE_USR).toContain('{STORY_POINTS}');
  });
});
