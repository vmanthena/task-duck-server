/**
 * Attempt to repair truncated JSON from LLM responses.
 * Tries progressively aggressive strategies to recover a parseable object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function repairJSON(raw: string): Record<string, any> | null {
  // Strategy 1: direct parse
  try { return JSON.parse(raw) as Record<string, any>; } catch { /* continue */ }

  // Strategy 2: strip markdown fences + extract { ... }
  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const extracted = cleaned.substring(firstBrace, lastBrace + 1);
    try { return JSON.parse(extracted) as Record<string, any>; } catch { /* continue */ }
  }

  // Strategy 3: truncated JSON — close open structures
  if (firstBrace !== -1) {
    let truncated = cleaned.substring(firstBrace);
    // Remove trailing incomplete string (ends mid-value)
    truncated = truncated.replace(/,\s*"[^"]*":\s*"[^"]*$/, '');
    // Remove trailing incomplete key
    truncated = truncated.replace(/,\s*"[^"]*$/, '');
    // Remove trailing comma
    truncated = truncated.replace(/,\s*$/, '');
    // Count open brackets/braces and close them
    let openBraces = 0, openBrackets = 0;
    let inString = false, escaped = false;
    for (const ch of truncated) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      else if (ch === '}') openBraces--;
      else if (ch === '[') openBrackets++;
      else if (ch === ']') openBrackets--;
    }
    // If we're inside a string, close it
    if (inString) truncated += '"';
    // Close open arrays then objects
    for (let i = 0; i < openBrackets; i++) truncated += ']';
    for (let i = 0; i < openBraces; i++) truncated += '}';
    try { return JSON.parse(truncated) as Record<string, any>; } catch { /* give up */ }
  }

  return null;
}
