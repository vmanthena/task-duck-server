import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ============================================================
// CONFIG — loaded from environment
// ============================================================
const PORT = process.env.PORT || 3000;
const PASSWORD_HASH = process.env.PASSWORD_HASH;           // Argon2 hash
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '24');

// LLM API Keys (all optional — only configured providers are available)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Custom mask dictionary (comma-separated key=replacement pairs)
// e.g. "myservice=SERVICE_A,prod-db-01=DATABASE_1"
const CUSTOM_MASKS_RAW = process.env.CUSTOM_MASKS || '';

// ============================================================
// ARGON2 — using Node's built-in crypto (scrypt-based)
// For true Argon2, install 'argon2' package. This uses scrypt
// as a zero-dependency alternative with similar security.
// ============================================================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts[0] === 'scrypt' && parts.length === 3) {
    const hash = crypto.scryptSync(password, parts[1], 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(parts[2]));
  }
  // Support raw argon2 hashes if argon2 package installed
  return false;
}

// ============================================================
// JWT-LIKE SESSION TOKENS (HMAC-based, zero-dependency)
// ============================================================
function createToken() {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + SESSION_HOURS * 3600000,
    nonce: crypto.randomBytes(8).toString('hex')
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [data, sig] = token.split('.');
  if (!data || !sig) return false;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.exp > Date.now();
  } catch { return false; }
}

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ============================================================
// SENSITIVE DATA MASKING ENGINE
// ============================================================
class DataMasker {
  constructor(customMasks = '') {
    this.map = new Map();       // original -> placeholder
    this.reverseMap = new Map(); // placeholder -> original
    this.counter = {};

    // Parse custom masks from env
    this.customDict = new Map();
    if (customMasks) {
      customMasks.split(',').forEach(pair => {
        const [key, val] = pair.split('=').map(s => s.trim());
        if (key && val) this.customDict.set(key.toLowerCase(), val);
      });
    }

    // Regex patterns for auto-detection
    this.patterns = [
      { name: 'EMAIL',    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi },
      { name: 'IP',       regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
      { name: 'URL',      regex: /https?:\/\/[^\s<>"']+/gi },
      { name: 'API_KEY',  regex: /\b(?:sk-|ak-|key-|token-)[A-Za-z0-9_-]{10,}\b/gi },
      { name: 'UUID',     regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
      { name: 'DB_CONN',  regex: /(?:mongodb|postgres|mysql|redis|mssql):\/\/[^\s<>"']+/gi },
      { name: 'PATH',     regex: /(?:\/[a-zA-Z0-9._-]+){3,}/g },
      { name: 'PHONE',    regex: /\b(?:\+1[-.]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
      { name: 'SSN',      regex: /\b\d{3}-\d{2}-\d{4}\b/g },
      { name: 'AWS_ARN',  regex: /arn:aws[a-zA-Z-]*:[a-zA-Z0-9-]+:\S+/gi },
      { name: 'K8S_NS',   regex: /\b(?:namespace|ns)[:\s=]+["']?([a-z0-9-]+)["']?/gi },
    ];
  }

  _getPlaceholder(category) {
    if (!this.counter[category]) this.counter[category] = 0;
    this.counter[category]++;
    return `[${category}_${this.counter[category]}]`;
  }

  mask(text) {
    if (!text) return text;
    let masked = text;

    // Apply custom dictionary first (case-insensitive)
    for (const [term, replacement] of this.customDict) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      masked = masked.replace(regex, (match) => {
        const ph = `[${replacement}]`;
        this.map.set(match, ph);
        this.reverseMap.set(ph, match);
        return ph;
      });
    }

    // Apply regex patterns
    for (const { name, regex } of this.patterns) {
      masked = masked.replace(regex, (match) => {
        // Skip if already masked
        if (match.startsWith('[') && match.endsWith(']')) return match;
        if (this.map.has(match)) return this.map.get(match);
        const ph = this._getPlaceholder(name);
        this.map.set(match, ph);
        this.reverseMap.set(ph, match);
        return ph;
      });
    }

    return masked;
  }

  unmask(text) {
    if (!text) return text;
    let unmasked = text;
    for (const [ph, original] of this.reverseMap) {
      unmasked = unmasked.replaceAll(ph, original);
    }
    return unmasked;
  }

  getMaskReport() {
    const report = [];
    for (const [original, placeholder] of this.map) {
      report.push({ original: original.substring(0, 3) + '***', placeholder });
    }
    return report;
  }
}

// ============================================================
// THE VERIFICATION PROMPT — carefully engineered
// ============================================================
const SYSTEM_PROMPT = `You are a Task Understanding Verifier for a software architect's workflow tool called "Task Duck." Your job is critical: compare an ORIGINAL task description against the architect's REWRITTEN understanding and detect any semantic drift, scope additions, missing requirements, or misinterpretations.

You serve as a rubber duck that catches the gap between "what was asked" and "what the architect THINKS was asked" — BEFORE any work begins.

## Your Analysis Framework

For each comparison, evaluate these dimensions:

1. **INTENT MATCH** — Does the rewrite capture the core intent of the original?
2. **SCOPE DRIFT** — Did the architect ADD anything not in the original? (This is the #1 problem to catch)
3. **MISSING ITEMS** — Did the architect OMIT anything from the original?
4. **ASSUMPTION FLAGS** — Did the architect make assumptions not supported by the original text?
5. **SPECIFICITY CHECK** — Is the rewrite more specific OR more vague than the original?

## Response Format

Respond ONLY with valid JSON (no markdown fences, no preamble):

{
  "verdict": "match" | "drift" | "missing" | "major_mismatch",
  "confidence": 0.0-1.0,
  "summary": "One sentence overall assessment",
  "intent_match": {
    "status": "aligned" | "partial" | "misaligned",
    "detail": "Explanation"
  },
  "scope_drift": {
    "detected": true/false,
    "items": ["List of things architect ADDED that aren't in original"]
  },
  "missing_items": {
    "detected": true/false,
    "items": ["List of things in original that architect MISSED"]
  },
  "assumptions": {
    "detected": true/false,
    "items": ["List of assumptions not supported by original"]
  },
  "suggestions": ["Actionable suggestions to fix the rewrite"],
  "duck_quote": "A short, direct duck-themed reminder about the specific issue found (or encouragement if it matches)"
}

## Rules
- Be STRICT about scope drift — this is the architect's known weakness
- Even small additions count as drift (e.g., "update config" vs "refactor config service")
- Verb changes matter: "add" vs "redesign", "fix" vs "rewrite", "update" vs "migrate"
- If deliverable is mentioned in original, verify the rewrite matches it exactly
- Note placeholders like [SERVICE_A] are masked sensitive data — analyze the structure, not the placeholder values
- Keep suggestions concrete and actionable
- The duck_quote should be memorable and specific to the issue found`;

const USER_PROMPT_TEMPLATE = `## ORIGINAL TASK (verbatim from ticket)
{ORIGINAL}

## ARCHITECT'S REWRITTEN UNDERSTANDING
{REWRITE}

## STATED DELIVERABLE
{DELIVERABLE}

## STATED "NOT IN SCOPE"
{NOT_ASKED}

Compare the original against the rewrite. Detect any drift, missing items, or assumptions. Be strict about scope additions.`;

// ============================================================
// LLM PROVIDER CALLS
// ============================================================
async function callAnthropic(systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
      metadata: { user_id: 'task-duck' }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(`Anthropic: ${data.error.message}`);
  return data.content?.[0]?.text || '';
}

async function callOpenAI(systemPrompt, userPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(systemPrompt, userPrompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 1500
        }
      })
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(`Gemini: ${data.error.message}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

const providers = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  gemini: callGemini
};

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.0' });
});

// Login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password || !verifyPassword(password, PASSWORD_HASH)) {
    // Constant-time delay to prevent timing attacks
    return setTimeout(() => res.status(401).json({ error: 'Invalid password' }), 500);
  }
  const token = createToken();
  res.json({ token, expiresIn: SESSION_HOURS * 3600 });
});

// Get available providers
app.get('/api/providers', requireAuth, (req, res) => {
  const available = [];
  if (ANTHROPIC_API_KEY) available.push({ id: 'anthropic', name: 'Claude (Anthropic)', model: 'claude-sonnet-4' });
  if (OPENAI_API_KEY) available.push({ id: 'openai', name: 'GPT-4o (OpenAI)', model: 'gpt-4o' });
  if (GEMINI_API_KEY) available.push({ id: 'gemini', name: 'Gemini 2.0 Flash', model: 'gemini-2.0-flash' });
  res.json({ providers: available });
});

// Verify understanding — the core endpoint
app.post('/api/verify', requireAuth, async (req, res) => {
  const { provider, original, rewrite, deliverable, notAsked } = req.body;

  if (!provider || !original || !rewrite) {
    return res.status(400).json({ error: 'Missing required fields: provider, original, rewrite' });
  }

  if (!providers[provider]) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  const apiKey = {
    anthropic: ANTHROPIC_API_KEY,
    openai: OPENAI_API_KEY,
    gemini: GEMINI_API_KEY
  }[provider];

  if (!apiKey) {
    return res.status(400).json({ error: `Provider ${provider} not configured` });
  }

  try {
    // Mask sensitive data
    const masker = new DataMasker(CUSTOM_MASKS_RAW);
    const maskedOriginal = masker.mask(original);
    const maskedRewrite = masker.mask(rewrite);
    const maskedDeliverable = masker.mask(deliverable || '');
    const maskedNotAsked = masker.mask(notAsked || '');

    // Build prompt
    const userPrompt = USER_PROMPT_TEMPLATE
      .replace('{ORIGINAL}', maskedOriginal)
      .replace('{REWRITE}', maskedRewrite)
      .replace('{DELIVERABLE}', maskedDeliverable || '(not specified)')
      .replace('{NOT_ASKED}', maskedNotAsked || '(not specified)');

    // Call LLM
    const rawResponse = await providers[provider](SYSTEM_PROMPT, userPrompt);

    // Parse JSON response
    let parsed;
    try {
      const cleaned = rawResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        verdict: 'error',
        summary: 'Could not parse LLM response',
        raw: rawResponse.substring(0, 500)
      };
    }

    // Unmask any sensitive data in the response
    if (parsed.scope_drift?.items) {
      parsed.scope_drift.items = parsed.scope_drift.items.map(i => masker.unmask(i));
    }
    if (parsed.missing_items?.items) {
      parsed.missing_items.items = parsed.missing_items.items.map(i => masker.unmask(i));
    }
    if (parsed.assumptions?.items) {
      parsed.assumptions.items = parsed.assumptions.items.map(i => masker.unmask(i));
    }
    if (parsed.suggestions) {
      parsed.suggestions = parsed.suggestions.map(s => masker.unmask(s));
    }
    if (parsed.summary) parsed.summary = masker.unmask(parsed.summary);
    if (parsed.duck_quote) parsed.duck_quote = masker.unmask(parsed.duck_quote);
    if (parsed.intent_match?.detail) parsed.intent_match.detail = masker.unmask(parsed.intent_match.detail);

    // Return — mask report tells user what was hidden
    res.json({
      result: parsed,
      masking: {
        itemsMasked: masker.map.size,
        report: masker.getMaskReport()
      },
      provider
    });

  } catch (err) {
    console.error(`[verify] Error with ${provider}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Utility: generate password hash
app.post('/api/hash-password', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  res.json({ hash: hashPassword(password) });
});

// Serve the frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ============================================================
// START
// ============================================================
if (!PASSWORD_HASH) {
  console.error('\n⚠️  PASSWORD_HASH not set!');
  console.error('Generate one by running:');
  console.error('  curl -X POST http://localhost:3000/api/hash-password -H "Content-Type: application/json" -d \'{"password":"your-password-here"}\'\n');
  console.error('Then set it in your .env file.\n');
  console.error('Starting server without auth for initial setup...\n');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🦆 Task Duck server running on port ${PORT}`);
  console.log(`   Providers: ${[
    ANTHROPIC_API_KEY ? '✓ Anthropic' : '✗ Anthropic',
    OPENAI_API_KEY ? '✓ OpenAI' : '✗ OpenAI',
    GEMINI_API_KEY ? '✓ Gemini' : '✗ Gemini'
  ].join(' | ')}`);
  console.log(`   Auth: ${PASSWORD_HASH ? '✓ Enabled' : '⚠ Disabled (set PASSWORD_HASH)'}`);
  console.log(`   Masking: ${CUSTOM_MASKS_RAW ? `✓ ${CUSTOM_MASKS_RAW.split(',').length} custom rules` : '✓ Auto-detection only'}\n`);
});
