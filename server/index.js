import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '50kb' }));

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
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// CORS — block cross-origin API calls but allow same-origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && req.path.startsWith('/api/')) {
    // Allow if origin matches the host
    const host = req.headers.host;
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return res.status(403).json({ error: 'Cross-origin not allowed' });
      }
    } catch {
      // If we can't parse, let it through (same-origin requests may have odd origins)
    }
  }
  next();
});

// ============================================================
// IP RATE LIMITING — 3 failed = 20 min lockout
// ============================================================
const loginAttempts = new Map();
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 20 * 60 * 1000;

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket.remoteAddress || 'unknown';
}

function isIPLocked(ip) {
  const r = loginAttempts.get(ip);
  if (!r) return false;
  if (r.lockedUntil && Date.now() < r.lockedUntil) return true;
  if (r.lockedUntil && Date.now() >= r.lockedUntil) { loginAttempts.delete(ip); return false; }
  return false;
}

function recordFail(ip) {
  const r = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
  r.count++;
  if (r.count >= MAX_ATTEMPTS) {
    r.lockedUntil = Date.now() + LOCKOUT_MS;
    console.warn(`[auth] IP ${ip} locked 20min (${r.count} fails)`);
  }
  loginAttempts.set(ip, r);
  return r;
}

function clearFails(ip) { loginAttempts.delete(ip); }

function getLockSeconds(ip) {
  const r = loginAttempts.get(ip);
  return r?.lockedUntil ? Math.max(0, Math.ceil((r.lockedUntil - Date.now()) / 1000)) : 0;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, d] of loginAttempts) {
    if (d.lockedUntil && now > d.lockedUntil + 60000) loginAttempts.delete(ip);
  }
}, 300000);

// ============================================================
// INPUT SANITIZATION
// ============================================================
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, '').replace(/data:/gi, '').substring(0, 10000);
}

function sanitizeBody(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const c = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') c[k] = sanitize(v);
    else if (typeof v === 'number' || typeof v === 'boolean') c[k] = v;
  }
  return c;
}

app.use((req, res, next) => {
  if (req.method === 'POST' && req.body) req.body = sanitizeBody(req.body);
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ============================================================
// CONFIG
// ============================================================
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '24');

// Auth: PASSWORD_VERIFIER = sha256(bcrypt(sha256(password)))
const PASSWORD_VERIFIER = (process.env.PASSWORD_VERIFIER || '').replace(/^["']|["']$/g, '').trim();
const BCRYPT_COST = Math.min(parseInt(process.env.BCRYPT_COST || '12'), 16);

// LLM Keys
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').replace(/^["']|["']$/g, '').trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();

const CUSTOM_MASKS_RAW = process.env.CUSTOM_MASKS || '';

// Startup diagnostics — key format check
if (ANTHROPIC_API_KEY) {
  const k = ANTHROPIC_API_KEY;
  if (!k.startsWith('sk-ant-')) console.warn('⚠️  ANTHROPIC_API_KEY does not start with sk-ant- — check .env format (no quotes!)');
  else console.log(`✅ Anthropic key loaded (${k.substring(0,10)}...${k.substring(k.length-4)}, ${k.length} chars)`);
}
if (OPENAI_API_KEY) console.log(`✅ OpenAI key loaded (${OPENAI_API_KEY.substring(0,7)}..., ${OPENAI_API_KEY.length} chars)`);
if (GEMINI_API_KEY) console.log(`✅ Gemini key loaded (${GEMINI_API_KEY.substring(0,7)}..., ${GEMINI_API_KEY.length} chars)`);

// ============================================================
// NONCE STORE
// ============================================================
const nonceStore = new Map();
const NONCE_TTL_MS = 60000; // 60s for bcrypt (it's slower than argon2)

setInterval(() => {
  const now = Date.now();
  for (const [n, d] of nonceStore) {
    if (now - d.created > NONCE_TTL_MS * 2) nonceStore.delete(n);
  }
}, 60000);

// ============================================================
// CHALLENGE-RESPONSE AUTH (bcrypt)
//
//  CLIENT:                                    SERVER:
//  ──────                                     ──────
//  GET /api/auth/challenge            ──►     { nonce, timestamp, bcryptSalt }
//
//  step1 = sha256(password)                   (SubtleCrypto)
//  step2 = bcrypt(step1, bcryptSalt)          (bcryptjs in browser)
//  verifier = sha256(step2)                   (SubtleCrypto)
//  proof = sha256(verifier+nonce+ts)
//
//  POST /api/auth/login { proof, ts } ──►     expected = sha256(VERIFIER+nonce+ts)
//                                             proof === expected? token : 401
//
// The bcryptSalt is pre-generated and stored in .env so both
// CLI and browser produce the same bcrypt hash for the same password.
// ============================================================

const BCRYPT_SALT = (process.env.BCRYPT_SALT || '').replace(/^["']|["']$/g, '').trim();

function verifyProof(proof, timestamp) {
  if (!proof || !timestamp || !PASSWORD_VERIFIER) return false;
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Date.now() - ts > NONCE_TTL_MS) return false;

  let matchedNonce = null;
  for (const [nonce, data] of nonceStore) {
    if (data.timestamp === timestamp && !data.used) { matchedNonce = nonce; break; }
  }
  if (!matchedNonce) return false;

  const nd = nonceStore.get(matchedNonce);
  if (Date.now() - nd.created > NONCE_TTL_MS) { nonceStore.delete(matchedNonce); return false; }

  const expected = crypto.createHash('sha256').update(PASSWORD_VERIFIER + matchedNonce + timestamp).digest('hex');
  if (proof.length !== expected.length) return false;
  let valid;
  try { valid = crypto.timingSafeEqual(Buffer.from(proof, 'hex'), Buffer.from(expected, 'hex')); }
  catch { return false; }
  if (valid) nd.used = true;
  return valid;
}

// ============================================================
// JWT TOKENS
// ============================================================
function createToken() {
  const p = { iat: Date.now(), exp: Date.now() + SESSION_HOURS * 3600000, jti: crypto.randomBytes(8).toString('hex') };
  const d = Buffer.from(JSON.stringify(p)).toString('base64url');
  const s = crypto.createHmac('sha256', JWT_SECRET).update(d).digest('base64url');
  return `${d}.${s}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [d, s] = token.split('.');
  if (!d || !s) return false;
  try {
    const exp = crypto.createHmac('sha256', JWT_SECRET).update(d).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp))) return false;
    return JSON.parse(Buffer.from(d, 'base64url').toString()).exp > Date.now();
  } catch { return false; }
}

function requireAuth(req, res, next) {
  const t = req.headers.authorization?.replace('Bearer ', '');
  if (!verifyToken(t)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ============================================================
// SENSITIVE DATA MASKING
// ============================================================
class DataMasker {
  constructor(cm = '') {
    this.map = new Map(); this.rev = new Map(); this.ctr = {};
    this.dict = new Map();
    if (cm) cm.split(',').forEach(p => { const [k,v] = p.split('=').map(s=>s.trim()); if(k&&v) this.dict.set(k.toLowerCase(),v); });
    this.pats = [
      { n:'EMAIL',  r:/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi },
      { n:'IP',     r:/\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
      { n:'URL',    r:/https?:\/\/[^\s<>"']+/gi },
      { n:'APIKEY', r:/\b(?:sk-|ak-|key-|token-)[A-Za-z0-9_-]{10,}\b/gi },
      { n:'UUID',   r:/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
      { n:'DBCONN', r:/(?:mongodb|postgres|mysql|redis|mssql):\/\/[^\s<>"']+/gi },
      { n:'PATH',   r:/(?:\/[a-zA-Z0-9._-]+){3,}/g },
      { n:'PHONE',  r:/\b(?:\+1[-.]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
      { n:'SSN',    r:/\b\d{3}-\d{2}-\d{4}\b/g },
      { n:'ARN',    r:/arn:aws[a-zA-Z-]*:[a-zA-Z0-9-]+:\S+/gi },
    ];
  }
  _ph(c) { this.ctr[c]=(this.ctr[c]||0)+1; return `[${c}_${this.ctr[c]}]`; }
  mask(t) {
    if(!t) return t; let m=t;
    for(const[k,v]of this.dict){const rx=new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');m=m.replace(rx,x=>{const p=`[${v}]`;this.map.set(x,p);this.rev.set(p,x);return p;});}
    for(const{n,r}of this.pats){m=m.replace(r,x=>{if(x.startsWith('[')&&x.endsWith(']'))return x;if(this.map.has(x))return this.map.get(x);const p=this._ph(n);this.map.set(x,p);this.rev.set(p,x);return p;});}
    return m;
  }
  unmask(t){if(!t)return t;let u=t;for(const[p,o]of this.rev)u=u.replaceAll(p,o);return u;}
  report(){return[...this.map].map(([o,p])=>({original:o.substring(0,3)+'***',placeholder:p}));}
}

// ============================================================
// VERIFICATION PROMPT
// ============================================================
const SYS_PROMPT = `Task Understanding Verifier. Compare ORIGINAL task vs architect's REWRITE.

Respond ONLY with valid JSON (no fences, no preamble):
{
  "verdict": "match" | "drift" | "missing" | "major_mismatch",
  "confidence": 0.0-1.0,
  "summary": "1 sentence. What's wrong or what matched.",
  "scope_drift": {"detected": bool, "items": ["1 short sentence each - what was added that shouldn't be"]},
  "missing_items": {"detected": bool, "items": ["1 short sentence each - what was missed from original"]},
  "assumptions": {"detected": bool, "items": ["1 short sentence each"]},
  "definition_of_done": {"clear": bool, "suggestion": "1 sentence - how to make DoD testable"},
  "spelling_grammar": {"issues": ["word → correction"]},
  "suggestions": ["1 sentence each - specific fix"],
  "duck_quote": "short duck-themed encouragement"
}

Rules:
- Be STRICT on scope drift. Verb changes matter ("add" vs "redesign").
- Be concise but specific. Each item should clearly state what's wrong.
- Max 3 items per category. Omit empty categories.
- Placeholders like [SERVICE_A] are masked sensitive data — analyze structure not values.`;

const USR_TMPL = `## ORIGINAL
{ORIGINAL}

## REWRITE
{REWRITE}

## DELIVERABLE
{DELIVERABLE}

## DEFINITION OF DONE
{DOD}

## NOT IN SCOPE
{NOT_ASKED}

Compare. Be concise but specific about each issue.`;

// ============================================================
// LLM PROVIDERS
// ============================================================
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

// Retry helper — backs off on 429/529 (overloaded)
async function fetchWithRetry(url, opts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const r = await fetch(url, opts);
    if (r.status === 429 || r.status === 529) {
      const wait = Math.min(2000 * Math.pow(2, i), 15000); // 2s, 4s, 8s
      console.warn(`[retry] ${r.status} — waiting ${wait}ms (attempt ${i + 1}/${retries})`);
      await new Promise(res => setTimeout(res, wait));
      continue;
    }
    return r;
  }
  // Final attempt
  return fetch(url, opts);
}

async function callAnthropic(s, u, modelOverride) {
  const useModel = modelOverride || ANTHROPIC_MODEL;
  const r = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: useModel, max_tokens: 2048, system: s, messages: [{ role: 'user', content: u }] })
  });
  if (!r.ok) {
    const text = await r.text();
    try { const d = JSON.parse(text); throw new Error(`Anthropic (${r.status}): ${d.error?.message || text.substring(0, 200)}`); }
    catch (e) { if (e.message.startsWith('Anthropic')) throw e; throw new Error(`Anthropic (${r.status}): ${text.substring(0, 200)}`); }
  }
  const d = await r.json();
  return d.content?.[0]?.text || '';
}

async function callOpenAI(s, u, _model) {
  const r = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: 2048, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: s }, { role: 'user', content: u }] })
  });
  if (!r.ok) {
    const text = await r.text();
    try { const d = JSON.parse(text); throw new Error(`OpenAI (${r.status}): ${d.error?.message || text.substring(0, 200)}`); }
    catch (e) { if (e.message.startsWith('OpenAI')) throw e; throw new Error(`OpenAI (${r.status}): ${text.substring(0, 200)}`); }
  }
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
}

async function callGemini(s, u, _model) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
  const r = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: s }] },
      contents: [{ parts: [{ text: u }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 }
    })
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Gemini (${r.status}): ${text.substring(0, 300)}`);
  }
  const d = await r.json();
  if (d.error) throw new Error(`Gemini: ${d.error.message}`);
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

const providers = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini };

// ============================================================
// ROUTES
// ============================================================
app.get('/api/health', (_,r) => r.json({status:'ok',version:'4.0.0'}));

// Challenge
app.get('/api/auth/challenge', (req, res) => {
  const ip = getClientIP(req);
  if (isIPLocked(ip)) return res.status(429).json({ error:'Locked', lockedFor:getLockSeconds(ip) });
  const nonce = crypto.randomBytes(32).toString('hex');
  const timestamp = String(Date.now());
  nonceStore.set(nonce, { timestamp, created:Date.now(), used:false });
  res.json({ nonce, timestamp, bcryptSalt: BCRYPT_SALT, bcryptCost: BCRYPT_COST });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const ip = getClientIP(req);
  if (isIPLocked(ip)) return res.status(429).json({ error:'Locked', lockedFor:getLockSeconds(ip) });

  const { proof, timestamp } = req.body;
  if (proof && (typeof proof!=='string' || !/^[a-f0-9]{64}$/.test(proof))) return res.status(400).json({error:'Bad proof'});
  if (timestamp && (typeof timestamp!=='string' || !/^\d{13}$/.test(timestamp))) return res.status(400).json({error:'Bad timestamp'});

  if (!PASSWORD_VERIFIER) return res.json({ token:createToken(), expiresIn:SESSION_HOURS*3600 });

  if (!verifyProof(proof, timestamp)) {
    const rec = recordFail(ip);
    const rem = MAX_ATTEMPTS - rec.count;
    return setTimeout(() => {
      if (rec.lockedUntil) res.status(429).json({ error:'Locked', lockedFor:getLockSeconds(ip) });
      else res.status(401).json({ error:'Invalid credentials', attemptsRemaining:Math.max(0,rem) });
    }, 500);
  }
  clearFails(ip);
  res.json({ token:createToken(), expiresIn:SESSION_HOURS*3600 });
});

// Providers — ordered cheapest first
app.get('/api/providers', requireAuth, (_,r) => {
  const a=[];
  if(GEMINI_API_KEY) a.push({id:'gemini',name:'Gemini Flash Lite',model:process.env.GEMINI_MODEL||'gemini-2.0-flash-lite',cost:'free'});
  if(OPENAI_API_KEY) a.push({id:'openai',name:'GPT-4o (OpenAI)',model:'gpt-4o',cost:'low'});
  if(ANTHROPIC_API_KEY) {
    a.push({id:'anthropic',name:'Claude Haiku',model:'claude-haiku-4-5-20251001',cost:'low'});
    a.push({id:'anthropic',name:'Claude Sonnet',model:'claude-sonnet-4-20250514',cost:'medium'});
  }
  r.json({providers:a});
});

// Verify — accepts optional model override
app.post('/api/verify', requireAuth, async (req, res) => {
  const {provider,original,rewrite,deliverable,notAsked,definitionOfDone,model} = req.body;
  if(!provider||!original||!rewrite) return res.status(400).json({error:'Missing fields: need provider, original, and rewrite'});
  if(!providers[provider]) return res.status(400).json({error:`Unknown provider: ${provider}`});
  const key={anthropic:ANTHROPIC_API_KEY,openai:OPENAI_API_KEY,gemini:GEMINI_API_KEY}[provider];
  if(!key) return res.status(400).json({error:`${provider} not configured — add API key to .env`});
  try {
    const m = new DataMasker(CUSTOM_MASKS_RAW);
    const up = USR_TMPL
      .replace('{ORIGINAL}',m.mask(original))
      .replace('{REWRITE}',m.mask(rewrite))
      .replace('{DELIVERABLE}',m.mask(deliverable||'')||'(none)')
      .replace('{DOD}',m.mask(definitionOfDone||'')||'(not specified)')
      .replace('{NOT_ASKED}',m.mask(notAsked||'')||'(none)');

    const raw = await providers[provider](SYS_PROMPT, up, model);

    if (!raw || !raw.trim()) {
      throw new Error(`${provider} returned an empty response. Try again.`);
    }

    // Parse JSON — strip markdown fences and any preamble
    let p;
    try {
      let cleaned = raw.trim();
      // Remove markdown code fences
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
      // Find the first { and last } to extract JSON
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      p = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error(`[verify] JSON parse failed for ${provider}. Raw response:`, raw.substring(0, 500));
      p = {
        verdict: 'error',
        confidence: 0,
        summary: `${provider} returned a response that couldn't be parsed as JSON. Try a different provider or re-verify.`,
        duck_quote: "Even ducks have bad days. Try again! 🦆"
      };
    }

    // Unmask any sensitive data in response
    const um = (o, k) => { if (o?.[k]) o[k] = Array.isArray(o[k]) ? o[k].map(i => m.unmask(i)) : m.unmask(o[k]); };
    um(p.scope_drift, 'items'); um(p.missing_items, 'items'); um(p.assumptions, 'items');
    um(p, 'suggestions'); um(p, 'summary'); um(p, 'duck_quote');
    um(p?.intent_match, 'detail'); um(p?.definition_of_done, 'suggestion');
    if (p?.spelling_grammar?.issues) p.spelling_grammar.issues = p.spelling_grammar.issues.map(i => m.unmask(i));

    res.json({ result: p, masking: { itemsMasked: m.map.size, report: m.report() }, provider });
  } catch (e) {
    console.error(`[verify] ${provider}:`, e.message);
    // Return the actual error message to the UI
    res.status(500).json({
      error: e.message,
      result: {
        verdict: 'error',
        confidence: 0,
        summary: e.message,
        duck_quote: "Something went wrong. Try again or switch providers. 🦆"
      }
    });
  }
});

// Re-scope — suggest corrected rewrite + DoD based on drift analysis
const RESCOPE_PROMPT = `Task Scope Corrector. Fix the architect's drifted rewrite to match the original task.

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

const RESCOPE_USR = `## ORIGINAL
{ORIGINAL}

## DRIFTED REWRITE
{REWRITE}

## CURRENT DOD
{DOD}

## DRIFT ISSUES
{DRIFT_SUMMARY}

Fix it. List every change in changes_made.`;

app.post('/api/rescope', requireAuth, async (req, res) => {
  const { provider, model, original, rewrite, dod, driftSummary } = req.body;
  if (!provider || !original || !rewrite) return res.status(400).json({ error: 'Missing fields' });
  if (!providers[provider]) return res.status(400).json({ error: `Unknown provider: ${provider}` });
  const key = { anthropic: ANTHROPIC_API_KEY, openai: OPENAI_API_KEY, gemini: GEMINI_API_KEY }[provider];
  if (!key) return res.status(400).json({ error: `${provider} not configured` });
  try {
    const m = new DataMasker(CUSTOM_MASKS_RAW);
    const up = RESCOPE_USR
      .replace('{ORIGINAL}', m.mask(original))
      .replace('{REWRITE}', m.mask(rewrite))
      .replace('{DOD}', m.mask(dod || '') || '(not specified)')
      .replace('{DRIFT_SUMMARY}', m.mask(driftSummary || '') || '(none)');
    const raw = await providers[provider](RESCOPE_PROMPT, up, model);
    if (!raw || !raw.trim()) throw new Error(`${provider} returned empty response`);
    let p;
    try {
      let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
      const fb = cleaned.indexOf('{'), lb = cleaned.lastIndexOf('}');
      if (fb !== -1 && lb > fb) cleaned = cleaned.substring(fb, lb + 1);
      p = JSON.parse(cleaned);
    } catch {
      p = { corrected_rewrite: '', corrected_dod: '', changes_made: ['Could not parse AI response'], duck_quote: 'Try again!' };
    }
    // Unmask
    if (p.corrected_rewrite) p.corrected_rewrite = m.unmask(p.corrected_rewrite);
    if (p.corrected_dod) p.corrected_dod = m.unmask(p.corrected_dod);
    if (p.changes_made) p.changes_made = p.changes_made.map(i => m.unmask(i));
    if (p.duck_quote) p.duck_quote = m.unmask(p.duck_quote);
    res.json({ result: p, provider });
  } catch (e) {
    console.error(`[rescope] ${provider}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (_,r) => r.sendFile(path.join(__dirname,'..','public','index.html')));

// ============================================================
// START
// ============================================================
if (!PASSWORD_VERIFIER) console.warn('\n⚠️  PASSWORD_VERIFIER not set! Run: node hash-password.js\n');
if (!BCRYPT_SALT) console.warn('⚠️  BCRYPT_SALT not set! Run: node hash-password.js --gen-salt\n');
if (parseInt(process.env.BCRYPT_COST || '12') > 14) console.warn(`⚠️  BCRYPT_COST=${process.env.BCRYPT_COST} is too high! Capped at 14. Cost 24 = ~17 min per hash. Regenerate: BCRYPT_COST=12 node hash-password.js\n`);
if (BCRYPT_SALT) {
  const m = BCRYPT_SALT.match(/^\$2[aby]?\$(\d+)\$/);
  if (m && parseInt(m[1]) > 14) console.warn(`⚠️  BCRYPT_SALT encodes cost ${m[1]}! Browser will freeze. Regenerate: BCRYPT_COST=12 node hash-password.js\n`);
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🦆 Task Duck v4.0.0 — port ${PORT}`);
  console.log(`   Auth: ${PASSWORD_VERIFIER ? '✓ bcrypt challenge-response' : '⚠ Open'}`);
  console.log(`   Providers: ${[ANTHROPIC_API_KEY?'✓ Claude ('+ANTHROPIC_MODEL+')':'✗ Claude',OPENAI_API_KEY?'✓ OpenAI':'✗ OpenAI',GEMINI_API_KEY?'✓ Gemini':'✗ Gemini'].join(' | ')}`);
  console.log(`   Masking: ${CUSTOM_MASKS_RAW ? `✓ ${CUSTOM_MASKS_RAW.split(',').length} custom` : '✓ Auto'}\n`);
});

server.on('error', (err) => {
  if (err.code==='EACCES') console.error(`\n❌ Port ${PORT} denied\n`);
  else if (err.code==='EADDRINUSE') console.error(`\n❌ Port ${PORT} in use\n`);
  else console.error(`\n❌`,err.message);
  process.exit(1);
});
