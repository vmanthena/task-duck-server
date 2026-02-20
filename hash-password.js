#!/usr/bin/env node

/**
 * Task Duck — Password Hash Generator
 *
 * Computes: PASSWORD_VERIFIER = hex(sha256(argon2id(sha256(password), salt, params)))
 *
 * The client (browser) computes the exact same chain using argon2-browser WASM.
 * The server only stores the final sha256 verifier — never the password or argon2 output.
 *
 * Usage:
 *   node hash-password.js                     Interactive (masked input)
 *   node hash-password.js "my-password"       Direct
 *   node hash-password.js --verify "pw"       Verify against .env
 *   node hash-password.js --salt "custom"     Use custom salt
 */

import crypto from 'crypto';
import { stdin, stdout } from 'process';

// ============================================================
// ARGON2 CONFIG — must match server + client
// ============================================================
const ARGON2_CONFIG = {
  timeCost: 5,           // 5 iterations
  memoryCost: 131072,    // 128 MB (in KB)
  parallelism: 8,        // 8 threads
  hashLength: 64,        // 64 bytes output
  type: 2,               // argon2id
};

const DEFAULT_SALT = 'task-duck-v3-default-salt';

// ============================================================
// HASH CHAIN: sha256(password) → argon2id → sha256 = verifier
// ============================================================
async function computeVerifier(password, salt) {
  // Step 1: sha256(password) → hex string
  const sha256Pass = crypto.createHash('sha256').update(password).digest('hex');

  // Step 2: argon2id(sha256Pass, salt, params) → hex string
  let argon2Hex;
  try {
    const argon2 = await import('argon2');
    const saltBuf = Buffer.from(salt, 'utf-8');
    const argon2Hash = await argon2.hash(sha256Pass, {
      type: argon2.argon2id,
      timeCost: ARGON2_CONFIG.timeCost,
      memoryCost: ARGON2_CONFIG.memoryCost,
      parallelism: ARGON2_CONFIG.parallelism,
      hashLength: ARGON2_CONFIG.hashLength,
      salt: saltBuf,
      raw: true,  // get raw bytes, not encoded string
    });
    argon2Hex = Buffer.from(argon2Hash).toString('hex');
  } catch (e) {
    console.error('\n❌ argon2 package required. Install with:');
    console.error('   npm install argon2\n');
    console.error('   (Inside Docker this is already installed)\n');
    process.exit(1);
  }

  // Step 3: sha256(argon2Hex) = verifier
  const verifier = crypto.createHash('sha256').update(argon2Hex).digest('hex');

  return { sha256Pass, argon2Hex, verifier };
}

// ============================================================
// INTERACTIVE PASSWORD INPUT
// ============================================================
function promptPassword(label = 'Enter password: ') {
  return new Promise(resolve => {
    stdout.write(label);
    let pw = '';
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      stdin.on('data', function handler(ch) {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', handler);
          stdout.write('\n');
          resolve(pw);
        } else if (ch === '\u007F' || ch === '\b') {
          if (pw.length > 0) { pw = pw.slice(0, -1); stdout.write('\b \b'); }
        } else if (ch === '\u0003') {
          process.exit(0);
        } else {
          pw += ch;
          stdout.write('•');
        }
      });
    } else {
      // Non-TTY fallback
      let data = '';
      stdin.resume();
      stdin.setEncoding('utf8');
      stdin.on('data', chunk => data += chunk);
      stdin.on('end', () => resolve(data.trim()));
    }
  });
}

// ============================================================
// CLI
// ============================================================
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🦆 Task Duck — Password Verifier Generator

Computes: PASSWORD_VERIFIER = sha256(argon2id(sha256(password), salt, params))

Usage:
  node hash-password.js                     Interactive (hidden input)
  node hash-password.js "password"          Direct
  node hash-password.js --salt "my-salt"    Custom salt (default: ${DEFAULT_SALT})
  node hash-password.js --verify "password" Check if password matches PASSWORD_VERIFIER in .env

Argon2id: ${ARGON2_CONFIG.timeCost} rounds, ${ARGON2_CONFIG.memoryCost / 1024}MB, ${ARGON2_CONFIG.parallelism} parallel, ${ARGON2_CONFIG.hashLength}B output
`);
    process.exit(0);
  }

  // Parse flags
  const saltIdx = args.indexOf('--salt');
  const salt = saltIdx !== -1 ? args[saltIdx + 1] : DEFAULT_SALT;
  const verifyMode = args.includes('--verify');

  // Get password
  let password;
  const positional = args.filter((a, i) => !a.startsWith('--') && (i === 0 || args[i - 1] !== '--salt'));
  if (positional.length > 0) {
    password = positional[0];
  } else {
    password = await promptPassword();
    if (!verifyMode) {
      const confirm = await promptPassword('Confirm password: ');
      if (password !== confirm) {
        console.error('\n❌ Passwords do not match.');
        process.exit(1);
      }
    }
  }

  if (password.length < 8) {
    console.error('\n❌ Password must be at least 8 characters.');
    process.exit(1);
  }

  console.log('\n⏳ Computing hash chain...');
  console.log(`   sha256(password) → argon2id(${ARGON2_CONFIG.timeCost}t, ${ARGON2_CONFIG.memoryCost / 1024}MB, ${ARGON2_CONFIG.parallelism}p) → sha256 = verifier\n`);

  const { sha256Pass, argon2Hex, verifier } = await computeVerifier(password, salt);

  if (verifyMode) {
    const envVerifier = process.env.PASSWORD_VERIFIER || '';
    if (!envVerifier) {
      console.error('❌ PASSWORD_VERIFIER not set in environment.');
      process.exit(1);
    }
    const match = envVerifier === verifier;
    console.log(match ? '✅ Password matches!' : '❌ Password does NOT match.');
    process.exit(match ? 0 : 1);
  }

  // Output
  const line = '━'.repeat(70);
  console.log(line);
  console.log('Hash chain:');
  console.log(`  sha256(pw)    = ${sha256Pass.substring(0, 16)}...`);
  console.log(`  argon2id(...) = ${argon2Hex.substring(0, 16)}...`);
  console.log(`  verifier      = ${verifier}`);
  console.log(line);
  console.log(`\nAdd these to your .env file:\n`);
  console.log(`PASSWORD_VERIFIER=${verifier}`);
  if (salt !== DEFAULT_SALT) {
    console.log(`ARGON2_SALT=${salt}`);
  }
  console.log(`\n${line}`);
  console.log(`\nSalt: ${salt}`);
  console.log(`Params: argon2id, ${ARGON2_CONFIG.timeCost}t, ${ARGON2_CONFIG.memoryCost / 1024}MB, ${ARGON2_CONFIG.parallelism}p, ${ARGON2_CONFIG.hashLength}B`);
  console.log('');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
