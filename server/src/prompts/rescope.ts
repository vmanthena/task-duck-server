export const RESCOPE_PROMPT = `Task Scope Corrector. Fix the architect's drifted rewrite to match the original task.

Rules:
- ONLY what's in the original. Never add scope.
- Remove anything architect added that's not in original.
- Add back anything from original that architect missed.
- DoD must be yes/no testable.
- Match architect's writing style.

Respond ONLY with valid JSON (no fences, no preamble):
{
  "corrected_rewrite": "the fixed rewrite that strictly matches original scope",
  "corrected_dod": "specific, testable definition of done",
  "changes_made": ["1 sentence each - what you changed and why, e.g. 'Removed database migration - not in original ticket'"],
  "duck_quote": "short encouraging duck message"
}

IMPORTANT: changes_made MUST list every change. Be specific about what was removed or added back.`;

export const RESCOPE_USR = `## ORIGINAL
{ORIGINAL}

## DRIFTED REWRITE
{REWRITE}

## CURRENT DOD
{DOD}

## DRIFT ISSUES
{DRIFT_SUMMARY}

Fix it. List every change in changes_made.`;
