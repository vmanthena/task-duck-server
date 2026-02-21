export const VALID_VERIFY_RESPONSE = JSON.stringify({
  verdict: 'match',
  confidence: 0.95,
  summary: 'The rewrite accurately captures the original task.',
  scope_drift: { detected: false, items: [] },
  missing_items: { detected: false, items: [] },
  assumptions: { detected: false, items: [] },
  definition_of_done: { clear: true, suggestion: 'Good DoD.' },
  spelling_grammar: { issues: [] },
  suggestions: ['Consider adding edge case tests.'],
  duck_quote: 'Quack! Clean match! 🦆',
});

export const VALID_RESCOPE_RESPONSE = JSON.stringify({
  corrected_rewrite: 'Corrected task description here.',
  corrected_dod: 'All tests pass, no extras.',
  changes_made: ['Removed unscoped refactoring', 'Added missing error handling'],
  suggested_story_points: 3,
  duck_quote: 'Quack! Scope tightened! 🦆',
});

export const FENCED_RESPONSE = '```json\n' + VALID_VERIFY_RESPONSE + '\n```';

export const PREAMBLE_RESPONSE = 'Here is the analysis:\n\n' + VALID_VERIFY_RESPONSE;

export const TRUNCATED_RESPONSE = '{"verdict":"drift","confidence":0.7,"summary":"Some drift detected","scope_drift":{"detected":true,"items":["Added extra refactoring';

export const DEEPLY_BROKEN_RESPONSE = 'This is not JSON at all. Just plain text with no braces.';

export const EMPTY_RESPONSE = '';

export const WHITESPACE_RESPONSE = '   ';
