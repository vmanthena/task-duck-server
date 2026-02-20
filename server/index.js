import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import 'dotenv/config';
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
const PASSWORD_VERIFIER = process.env.PASSWORD_VERIFIER || '';
const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12');

// LLM Keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const CUSTOM_MASKS_RAW = process.env.CUSTOM_MASKS || '';

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

const BCRYPT_SALT = process.env.BCRYPT_SALT || '';

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
const SYS_PROMPT = `You are a Task Understanding Verifier for "Task Duck." Compare an ORIGINAL task against the architect's REWRITTEN understanding and detect semantic drift, scope additions, missing requirements, or misinterpretations.

Evaluate: 1) INTENT MATCH 2) SCOPE DRIFT (architect's #1 weakness) 3) MISSING ITEMS 4) ASSUMPTIONS 5) SPECIFICITY

Respond ONLY with valid JSON:
{"verdict":"match"|"drift"|"missing"|"major_mismatch","confidence":0.0-1.0,"summary":"...","intent_match":{"status":"aligned"|"partial"|"misaligned","detail":"..."},"scope_drift":{"detected":bool,"items":[]},"missing_items":{"detected":bool,"items":[]},"assumptions":{"detected":bool,"items":[]},"suggestions":[],"duck_quote":"..."}

Rules: Be STRICT on scope drift. Verb changes matter. Placeholders like [SERVICE_A] are masked data.`;

const USR_TMPL = `## ORIGINAL TASK\n{ORIGINAL}\n\n## ARCHITECT'S REWRITE\n{REWRITE}\n\n## DELIVERABLE\n{DELIVERABLE}\n\n## NOT IN SCOPE\n{NOT_ASKED}\n\nDetect drift, missing items, assumptions. Be strict.`;

// ============================================================
// LLM PROVIDERS
// ============================================================
async function callAnthropic(s, u) {
  const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'}, body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1500,system:s,messages:[{role:'user',content:u}]}) });
  const d = await r.json(); if(d.error) throw new Error(`Anthropic: ${d.error.message}`); return d.content?.[0]?.text||'';
}
async function callOpenAI(s, u) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${OPENAI_API_KEY}`}, body:JSON.stringify({model:'gpt-4o',max_tokens:1500,response_format:{type:'json_object'},messages:[{role:'system',content:s},{role:'user',content:u}]}) });
  const d = await r.json(); if(d.error) throw new Error(`OpenAI: ${d.error.message}`); return d.choices?.[0]?.message?.content||'';
}
async function callGemini(s, u) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({system_instruction:{parts:[{text:s}]},contents:[{parts:[{text:u}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:1500}}) });
  const d = await r.json(); if(d.error) throw new Error(`Gemini: ${d.error.message}`); return d.candidates?.[0]?.content?.parts?.[0]?.text||'';
}
const providers = { anthropic:callAnthropic, openai:callOpenAI, gemini:callGemini };

// ============================================================
// ROUTES
// ============================================================
app.get('/api/health', (_,r) => r.json({status:'ok',version:'3.2.0'}));

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

// Providers
app.get('/api/providers', requireAuth, (_,r) => {
  const a=[];
  if(ANTHROPIC_API_KEY) a.push({id:'anthropic',name:'Claude (Anthropic)',model:'claude-sonnet-4'});
  if(OPENAI_API_KEY) a.push({id:'openai',name:'GPT-4o (OpenAI)',model:'gpt-4o'});
  if(GEMINI_API_KEY) a.push({id:'gemini',name:'Gemini 2.0 Flash',model:'gemini-2.0-flash'});
  r.json({providers:a});
});

// Verify
app.post('/api/verify', requireAuth, async (req, res) => {
  const {provider,original,rewrite,deliverable,notAsked} = req.body;
  if(!provider||!original||!rewrite) return res.status(400).json({error:'Missing fields'});
  if(!providers[provider]) return res.status(400).json({error:`Unknown: ${provider}`});
  const key={anthropic:ANTHROPIC_API_KEY,openai:OPENAI_API_KEY,gemini:GEMINI_API_KEY}[provider];
  if(!key) return res.status(400).json({error:`${provider} not configured`});
  try {
    const m = new DataMasker(CUSTOM_MASKS_RAW);
    const up = USR_TMPL.replace('{ORIGINAL}',m.mask(original)).replace('{REWRITE}',m.mask(rewrite)).replace('{DELIVERABLE}',m.mask(deliverable||'')||'(none)').replace('{NOT_ASKED}',m.mask(notAsked||'')||'(none)');
    const raw = await providers[provider](SYS_PROMPT, up);
    let p; try{p=JSON.parse(raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim());}catch{p={verdict:'error',summary:'Parse failed'};}
    const um=(o,k)=>{if(o?.[k])o[k]=Array.isArray(o[k])?o[k].map(i=>m.unmask(i)):m.unmask(o[k]);};
    um(p.scope_drift,'items');um(p.missing_items,'items');um(p.assumptions,'items');um(p,'suggestions');um(p,'summary');um(p,'duck_quote');um(p?.intent_match,'detail');
    res.json({result:p,masking:{itemsMasked:m.map.size,report:m.report()},provider});
  } catch(e) { console.error(`[verify] ${provider}:`,e.message); res.status(500).json({error:e.message}); }
});

app.get('*', (_,r) => r.sendFile(path.join(__dirname,'..','public','index.html')));

// ============================================================
// START
// ============================================================
if (!PASSWORD_VERIFIER) console.warn('\n⚠️  PASSWORD_VERIFIER not set! Run: node hash-password.js\n');
if (!BCRYPT_SALT) console.warn('⚠️  BCRYPT_SALT not set! Run: node hash-password.js --gen-salt\n');

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🦆 Task Duck v3.2.0 — port ${PORT}`);
  console.log(`   Auth: ${PASSWORD_VERIFIER ? '✓ bcrypt challenge-response (cost '+BCRYPT_COST+')' : '⚠ Open'}`);
  console.log(`   Providers: ${[ANTHROPIC_API_KEY?'✓ Claude':'✗ Claude',OPENAI_API_KEY?'✓ OpenAI':'✗ OpenAI',GEMINI_API_KEY?'✓ Gemini':'✗ Gemini'].join(' | ')}`);
  console.log(`   Masking: ${CUSTOM_MASKS_RAW ? `✓ ${CUSTOM_MASKS_RAW.split(',').length} custom` : '✓ Auto'}\n`);
});

server.on('error', (err) => {
  if (err.code==='EACCES') console.error(`\n❌ Port ${PORT} denied\n`);
  else if (err.code==='EADDRINUSE') console.error(`\n❌ Port ${PORT} in use\n`);
  else console.error(`\n❌`,err.message);
  process.exit(1);
});
