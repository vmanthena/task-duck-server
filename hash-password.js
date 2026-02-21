#!/usr/bin/env node

/**
 * Task Duck — Password Hash Generator (bcrypt)
 *
 * Chain: sha256(password) → bcrypt(sha256, salt, cost) → sha256 = verifier
 *
 * Usage:
 *   node hash-password.js                  Interactive
 *   node hash-password.js "password"       Direct
 *   node hash-password.js --gen-salt       Generate a new bcrypt salt
 *   node hash-password.js --verify "pw"    Verify against env
 */
import 'dotenv/config';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { stdin, stdout } from 'process';

const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12');

// ============================================================
// HASH CHAIN
// sha256(password) → bcrypt(result, salt, cost) → sha256 = verifier
// ============================================================
function computeVerifier(password, salt) {
  // Step 1: sha256(password) → hex
  const sha256Pass = crypto.createHash('sha256').update(password).digest('hex');

  // Step 2: bcrypt(sha256Pass, salt) → bcrypt hash string
  // bcryptjs.hashSync uses the provided salt (which embeds the cost)
  const bcryptHash = bcrypt.hashSync(sha256Pass, salt);

  // Step 3: sha256(bcryptHash) → hex = verifier
  const verifier = crypto.createHash('sha256').update(bcryptHash).digest('hex');

  return { sha256Pass, bcryptHash, verifier };
}

// ============================================================
// INTERACTIVE INPUT
// ============================================================
function prompt(label = 'Enter password: ') {
  return new Promise(resolve => {
    stdout.write(label);
    let pw = '';
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      const handler = (ch) => {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', handler);
          stdout.write('\n'); resolve(pw);
        } else if (ch === '\u007F' || ch === '\b') {
          if (pw.length) { pw = pw.slice(0,-1); stdout.write('\b \b'); }
        } else if (ch === '\u0003') { process.exit(0); }
        else { pw += ch; stdout.write('•'); }
      };
      stdin.on('data', handler);
    } else {
      let d = '';
      stdin.resume(); stdin.setEncoding('utf8');
      stdin.on('data', c => d += c);
      stdin.on('end', () => resolve(d.trim()));
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
🦆 Task Duck — Password Hash Generator (bcrypt)

Chain: sha256(password) → bcrypt(cost ${BCRYPT_COST}) → sha256 = verifier

Usage:
  node hash-password.js                  Interactive (hidden input)
  node hash-password.js "password"       Direct
  node hash-password.js --gen-salt       Generate a bcrypt salt only
  node hash-password.js --verify "pw"    Check against PASSWORD_VERIFIER env
`);
    process.exit(0);
  }

  // Generate salt only
  if (args.includes('--gen-salt')) {
    const salt = bcrypt.genSaltSync(BCRYPT_COST);
    console.log(`\nBCRYPT_SALT=${salt}\n`);
    console.log(`Cost: ${BCRYPT_COST} rounds`);
    console.log('Add this to your .env file.\n');
    process.exit(0);
  }

  // Get or generate salt
  let salt = process.env.BCRYPT_SALT;
  if (!salt) {
    console.log('\nNo BCRYPT_SALT found — generating a new one...');
    salt = bcrypt.genSaltSync(BCRYPT_COST);
    console.log(`Generated: ${salt}\n`);
  }

  // Get password
  let password;
  const positional = args.filter(a => !a.startsWith('--'));
  if (positional.length) {
    password = positional[0];
  } else {
    password = await prompt();
    if (!args.includes('--verify')) {
      const confirm = await prompt('Confirm password: ');
      if (password !== confirm) { console.error('\n❌ Passwords do not match.'); process.exit(1); }
    }
  }

  if (password.length < 8) { console.error('\n❌ Minimum 8 characters.'); process.exit(1); }

  // Verify mode
  if (args.includes('--verify')) {
    const envV = process.env.PASSWORD_VERIFIER;
    if (!envV) { console.error('❌ PASSWORD_VERIFIER not in env'); process.exit(1); }
    const { verifier } = computeVerifier(password, salt);
    console.log(verifier === envV ? '\n✅ Password matches!' : '\n❌ Password does NOT match.');
    process.exit(verifier === envV ? 0 : 1);
  }

  console.log('\n⏳ Computing: sha256 → bcrypt → sha256...\n');
  const { sha256Pass, bcryptHash, verifier } = computeVerifier(password, salt);

  const line = '━'.repeat(70);
  console.log(line);
  console.log('Chain:');
  console.log(`  sha256(pw)       = ${sha256Pass.substring(0,20)}...`);
  console.log(`  bcrypt(sha256)   = ${bcryptHash.substring(0,30)}...`);
  console.log(`  sha256(bcrypt)   = ${verifier}`);
  console.log(line);
  console.log('\nAdd these to your .env file:\n');
  console.log(`BCRYPT_SALT=${salt}`);
  console.log(`PASSWORD_VERIFIER=${verifier}`);
  console.log(`\n${line}\n`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
