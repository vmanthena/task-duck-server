import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Body parsing with size limits
app.use(express.json({ limit: '50kb' }));

// Security headers (helmet-lite, zero deps)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  // Prevent MIME sniffing
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// CORS — only allow same-origin (no cross-origin API access)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    // Block all cross-origin requests to API routes
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Cross-origin requests not allowed' });
    }
  }
  next();
});

// ============================================================
// IP RATE LIMITING — 3 failed login attempts = 20 min lockout
// ============================================================
const loginAttempts = new Map(); // ip -> { count, lockedUntil }
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 20 * 60 * 1000; // 20 minutes

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket.remoteAddress
    || 'unknown';
}

function isIPLocked(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (record.lockedUntil && Date.now() < record.lockedUntil) return true;
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttempts.delete(ip);
    return false;
  }
  return false;
}

function recordFailedAttempt(ip) {
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
  record.count++;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
    console.warn(`[auth] IP ${ip} locked for 20 min after ${record.count} failed attempts`);
  }
  loginAttempts.set(ip, record);
  return record;
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

function getRemainingLockout(ip) {
  const record = loginAttempts.get(ip);
  if (!record?.lockedUntil) return 0;
  return Math.max(0, Math.ceil((record.lockedUntil - Date.now()) / 1000));
}

// Cleanup stale lockout records every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of loginAttempts) {
    if (data.lockedUntil && now > data.lockedUntil + 60000) loginAttempts.delete(ip);
  }
}, 300000);

// ============================================================
// INPUT SANITIZATION — strip HTML/script injection
// ============================================================
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')           // strip angle brackets
    .replace(/javascript:/gi, '')    // strip js: protocol
    .replace(/on\w+\s*=/gi, '')      // strip event handlers
    .replace(/data:/gi, '')          // strip data: protocol
    .substring(0, 10000);            // hard length cap
}

function sanitizeBody(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') clean[key] = sanitize(val);
    else if (typeof val === 'number') clean[key] = val;
    else if (typeof val === 'boolean') clean[key] = val;
    // drop anything else
  }
  return clean;
}

// Apply sanitization to all POST requests
app.use((req, res, next) => {
  if (req.method === 'POST' && req.body) {
    req.body = sanitizeBody(req.body);
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// ============================================================
// CONFIG
// ============================================================
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '24');

// Auth: PASSWORD_VERIFIER = hex(sha256(argon2id(sha256(password), salt, params)))
// Generated by: node hash-password.js
const PASSWORD_VERIFIER = process.env.PASSWORD_VERIFIER || '';

// LLM API Keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Custom mask dictionary
const CUSTOM_MASKS_RAW = process.env.CUSTOM_MASKS || '';

// Argon2 params — sent to client so it can compute the same hash
const ARGON2_SALT = process.env.ARGON2_SALT || 'task-duck-v3-default-salt';
const ARGON2_PARAMS = {
  timeCost: 5,
  memoryCost: 131072,  // 128MB in KB
  parallelism: 8,
  hashLength: 64,
  type: 'argon2id',
  salt: ARGON2_SALT,
};

// ============================================================
// NONCE STORE — single-use, 30s TTL
// ============================================================
const nonceStore = new Map();
const NONCE_TTL_MS = 30000;

setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of nonceStore) {
    if (now - data.created > NONCE_TTL_MS * 2) nonceStore.delete(nonce);
  }
}, 60000);

// ============================================================
// CHALLENGE-RESPONSE AUTH
//
//  CLIENT (browser, WASM argon2):              SERVER:
//  ─────────────────────────────               ──────
//  GET /api/auth/challenge          ──────►    generate nonce + timestamp
//                                   ◄──────    { nonce, timestamp, argon2Params }
//
//  step1 = sha256(password)           (hex)
//  step2 = argon2id(step1, salt)      (hex)    ← same params + salt as CLI
//  verifier = sha256(step2)           (hex)
//  proof = sha256(verifier+nonce+ts)  (hex)
//
//  POST /api/auth/login { proof, ts } ──────►  expected = sha256(VERIFIER+nonce+ts)
//                                              compare proof === expected
//                                   ◄──────    { token } or 401
//
// NEVER leaves browser: password, sha256(password), argon2 output
// Over the wire: only proof (one-time sha256 hash, replay-proof)
// Stored on server: only PASSWORD_VERIFIER (sha256 of argon2 output)
// ============================================================

function verifyProof(proof, timestamp) {
  if (!proof || !timestamp || !PASSWORD_VERIFIER) return false;

  const ts = parseInt(timestamp);
  if (isNaN(ts) || Date.now() - ts > NONCE_TTL_MS) return false;

  // Find matching unused nonce
  let matchedNonce = null;
  for (const [nonce, data] of nonceStore) {
    if (data.timestamp === timestamp && !data.used) {
      matchedNonce = nonce;
      break;
    }
  }
  if (!matchedNonce) return false;

  const nonceData = nonceStore.get(matchedNonce);
  if (Date.now() - nonceData.created > NONCE_TTL_MS) {
    nonceStore.delete(matchedNonce);
    return false;
  }

  // expected = sha256(PASSWORD_VERIFIER + nonce + timestamp)
  const expected = crypto.createHash('sha256')
    .update(PASSWORD_VERIFIER + matchedNonce + timestamp)
    .digest('hex');

  if (proof.length !== expected.length) return false;
  let valid;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(proof, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }

  if (valid) nonceData.used = true;
  return valid;
}

// ============================================================
// JWT SESSION TOKENS
// ============================================================
function createToken() {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + SESSION_HOURS * 3600000,
    jti: crypto.randomBytes(8).toString('hex')
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [data, sig] = token.split('.');
  if (!data || !sig) return false;
  try {
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.exp > Date.now();
  } catch { return false; }
}

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
    this.map = new Map();
    this.reverseMap = new Map();
    this.counter = {};
    this.customDict = new Map();
    if (customMasks) {
      customMasks.split(',').forEach(pair => {
        const [key, val] = pair.split('=').map(s => s.trim());
        if (key && val) this.customDict.set(key.toLowerCase(), val);
      });
    }
    this.patterns = [
      { name: 'EMAIL',   regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi },
      { name: 'IP',      regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
      { name: 'URL',     regex: /https?:\/\/[^\s<>"']+/gi },
      { name: 'API_KEY', regex: /\b(?:sk-|ak-|key-|token-)[A-Za-z0-9_-]{10,}\b/gi },
      { name: 'UUID',    regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
      { name: 'DB_CONN', regex: /(?:mongodb|postgres|mysql|redis|mssql):\/\/[^\s<>"']+/gi },
      { name: 'PATH',    regex: /(?:\/[a-zA-Z0-9._-]+){3,}/g },
      { name: 'PHONE',   regex: /\b(?:\+1[-.]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
      { name: 'SSN',     regex: /\b\d{3}-\d{2}-\d{4}\b/g },
      { name: 'AWS_ARN', regex: /arn:aws[a-zA-Z-]*:[a-zA-Z0-9-]+:\S+/gi },
      { name: 'K8S_NS',  regex: /\b(?:namespace|ns)[:\s=]+["']?([a-z0-9-]+)["']?/gi },
    ];
  }

  _ph(cat) { this.counter[cat] = (this.counter[cat] || 0) + 1; return `[${cat}_${this.counter[cat]}]`; }

  mask(text) {
    if (!text) return text;
    let m = text;
    for (const [term, repl] of this.customDict) {
      const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      m = m.replace(rx, (match) => { const p = `[${repl}]`; this.map.set(match, p); this.reverseMap.set(p, match); return p; });
    }
    for (const { name, regex } of this.patterns) {
      m = m.replace(regex, (match) => {
        if (match.startsWith('[') && match.endsWith(']')) return match;
        if (this.map.has(match)) return this.map.get(match);
        const p = this._ph(name); this.map.set(match, p); this.reverseMap.set(p, match); return p;
      });
    }
    return m;
  }

  unmask(text) {
    if (!text) return text;
    let u = text;
    for (const [ph, orig] of this.reverseMap) u = u.replaceAll(ph, orig);
    return u;
  }

  getMaskReport() {
    return [...this.map].map(([orig, ph]) => ({ original: orig.substring(0, 3) + '***', placeholder: ph }));
  }
}

// ============================================================
// VERIFICATION PROMPT
// ============================================================
const SYSTEM_PROMPT = `You are a Task Understanding Verifier for a software architect's workflow tool called "Task Duck." Your job is critical: compare an ORIGINAL task description against the architect's REWRITTEN understanding and detect any semantic drift, scope additions, missing requirements, or misinterpretations.

You serve as a rubber duck that catches the gap between "what was asked" and "what the architect THINKS was asked" — BEFORE any work begins.

## Your Analysis Framework

1. **INTENT MATCH** — Does the rewrite capture the core intent of the original?
2. **SCOPE DRIFT** — Did the architect ADD anything not in the original? (#1 problem to catch)
3. **MISSING ITEMS** — Did the architect OMIT anything from the original?
4. **ASSUMPTION FLAGS** — Did the architect make assumptions not supported by the original text?
5. **SPECIFICITY CHECK** — Is the rewrite more specific OR more vague than the original?

## Response Format

Respond ONLY with valid JSON (no markdown fences, no preamble):

{
  "verdict": "match" | "drift" | "missing" | "major_mismatch",
  "confidence": 0.0-1.0,
  "summary": "One sentence overall assessment",
  "intent_match": { "status": "aligned" | "partial" | "misaligned", "detail": "Explanation" },
  "scope_drift": { "detected": true/false, "items": ["things architect ADDED not in original"] },
  "missing_items": { "detected": true/false, "items": ["things in original architect MISSED"] },
  "assumptions": { "detected": true/false, "items": ["assumptions not supported by original"] },
  "suggestions": ["Actionable suggestions to fix the rewrite"],
  "duck_quote": "A short duck-themed reminder about the specific issue (or encouragement if match)"
}

## Rules
- Be STRICT about scope drift — the architect's known weakness
- Even small additions count as drift
- Verb changes matter: "add" vs "redesign", "fix" vs "rewrite", "update" vs "migrate"
- Placeholders like [SERVICE_A] are masked sensitive data — analyze structure not values
- Keep suggestions concrete and actionable`;

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
// LLM PROVIDERS
// ============================================================
async function callAnthropic(sys, usr) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system: sys, messages: [{ role: 'user', content: usr }] })
  });
  const d = await r.json();
  if (d.error) throw new Error(`Anthropic: ${d.error.message}`);
  return d.content?.[0]?.text || '';
}

async function callOpenAI(sys, usr) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: 1500, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }] })
  });
  const d = await r.json();
  if (d.error) throw new Error(`OpenAI: ${d.error.message}`);
  return d.choices?.[0]?.message?.content || '';
}

async function callGemini(sys, usr) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ parts: [{ text: usr }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1500 } })
  });
  const d = await r.json();
  if (d.error) throw new Error(`Gemini: ${d.error.message}`);
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

const providers = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini };

// ============================================================
// ROUTES
// ============================================================
app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '3.1.0' }));

// Challenge — check IP lockout before issuing
app.get('/api/auth/challenge', (req, res) => {
  const ip = getClientIP(req);
  if (isIPLocked(ip)) {
    const remaining = getRemainingLockout(ip);
    return res.status(429).json({
      error: 'Too many failed attempts',
      lockedFor: remaining,
      retryAfter: remaining
    });
  }
  const nonce = crypto.randomBytes(32).toString('hex');
  const timestamp = String(Date.now());
  nonceStore.set(nonce, { timestamp, created: Date.now(), used: false });
  res.json({ nonce, timestamp, argon2Params: ARGON2_PARAMS });
});

// Login (proof verification) — with IP lockout
app.post('/api/auth/login', (req, res) => {
  const ip = getClientIP(req);

  if (isIPLocked(ip)) {
    const remaining = getRemainingLockout(ip);
    return res.status(429).json({
      error: 'Too many failed attempts',
      lockedFor: remaining,
      retryAfter: remaining
    });
  }

  const { proof, timestamp } = req.body;

  // Input validation
  if (proof && (typeof proof !== 'string' || !/^[a-f0-9]{64}$/.test(proof))) {
    return res.status(400).json({ error: 'Invalid proof format' });
  }
  if (timestamp && (typeof timestamp !== 'string' || !/^\d{13}$/.test(timestamp))) {
    return res.status(400).json({ error: 'Invalid timestamp format' });
  }

  if (!PASSWORD_VERIFIER) {
    return res.json({ token: createToken(), expiresIn: SESSION_HOURS * 3600 });
  }

  if (!verifyProof(proof, timestamp)) {
    const record = recordFailedAttempt(ip);
    const remaining = MAX_ATTEMPTS - record.count;
    return setTimeout(() => {
      if (record.lockedUntil) {
        res.status(429).json({
          error: 'Too many failed attempts',
          lockedFor: getRemainingLockout(ip),
          retryAfter: getRemainingLockout(ip)
        });
      } else {
        res.status(401).json({
          error: 'Invalid credentials',
          attemptsRemaining: Math.max(0, remaining)
        });
      }
    }, 500);
  }

  clearAttempts(ip);
  res.json({ token: createToken(), expiresIn: SESSION_HOURS * 3600 });
});

// Providers
app.get('/api/providers', requireAuth, (_, res) => {
  const a = [];
  if (ANTHROPIC_API_KEY) a.push({ id: 'anthropic', name: 'Claude (Anthropic)', model: 'claude-sonnet-4' });
  if (OPENAI_API_KEY) a.push({ id: 'openai', name: 'GPT-4o (OpenAI)', model: 'gpt-4o' });
  if (GEMINI_API_KEY) a.push({ id: 'gemini', name: 'Gemini 2.0 Flash', model: 'gemini-2.0-flash' });
  res.json({ providers: a });
});

// Verify understanding
app.post('/api/verify', requireAuth, async (req, res) => {
  const { provider, original, rewrite, deliverable, notAsked } = req.body;
  if (!provider || !original || !rewrite) return res.status(400).json({ error: 'Missing fields' });
  if (!providers[provider]) return res.status(400).json({ error: `Unknown provider: ${provider}` });
  const key = { anthropic: ANTHROPIC_API_KEY, openai: OPENAI_API_KEY, gemini: GEMINI_API_KEY }[provider];
  if (!key) return res.status(400).json({ error: `${provider} not configured` });

  try {
    const m = new DataMasker(CUSTOM_MASKS_RAW);
    const up = USER_PROMPT_TEMPLATE
      .replace('{ORIGINAL}', m.mask(original))
      .replace('{REWRITE}', m.mask(rewrite))
      .replace('{DELIVERABLE}', m.mask(deliverable || '') || '(not specified)')
      .replace('{NOT_ASKED}', m.mask(notAsked || '') || '(not specified)');

    const raw = await providers[provider](SYSTEM_PROMPT, up);
    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); }
    catch { parsed = { verdict: 'error', summary: 'Could not parse LLM response' }; }

    // Unmask
    const um = (o, k) => { if (o?.[k]) o[k] = Array.isArray(o[k]) ? o[k].map(i => m.unmask(i)) : m.unmask(o[k]); };
    um(parsed.scope_drift, 'items'); um(parsed.missing_items, 'items'); um(parsed.assumptions, 'items');
    um(parsed, 'suggestions'); um(parsed, 'summary'); um(parsed, 'duck_quote'); um(parsed?.intent_match, 'detail');

    res.json({ result: parsed, masking: { itemsMasked: m.map.size, report: m.getMaskReport() }, provider });
  } catch (err) {
    console.error(`[verify] ${provider}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ============================================================
// START
// ============================================================
if (!PASSWORD_VERIFIER) {
  console.warn('\n⚠️  PASSWORD_VERIFIER not set! Run: node hash-password.js\n');
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🦆 Task Duck v3.1.0 — port ${PORT}`);
  console.log(`   Auth: ${PASSWORD_VERIFIER ? '✓ Challenge-response (Argon2id+nonce)' : '⚠ Open (set PASSWORD_VERIFIER)'}`);
  console.log(`   Providers: ${[ANTHROPIC_API_KEY ? '✓ Claude' : '✗ Claude', OPENAI_API_KEY ? '✓ OpenAI' : '✗ OpenAI', GEMINI_API_KEY ? '✓ Gemini' : '✗ Gemini'].join(' | ')}`);
  console.log(`   Masking: ${CUSTOM_MASKS_RAW ? `✓ ${CUSTOM_MASKS_RAW.split(',').length} custom` : '✓ Auto'}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EACCES') console.error(`\n❌ Port ${PORT} denied. Set PORT= in .env\n`);
  else if (err.code === 'EADDRINUSE') console.error(`\n❌ Port ${PORT} in use. Set PORT= in .env\n`);
  else console.error(`\n❌`, err.message);
  process.exit(1);
});
