/**
 * Unit tests for lib/password-reset.ts — token round-trip, tampering,
 * expiry, and invalidation after password change.
 * Run: npx tsx scripts/test-password-reset.ts
 */
import { createResetToken, verifyResetToken } from '../lib/password-reset';

let failures = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}`, extra ?? ''); }
}

const user = { id: 'u123', email: 'pm@kodupm.com', password: '$2a$12$abcdefghijklmnopqrstuv1234567890hash' };

console.log('1) Round-trip');
const token = createResetToken(user);
const payload = verifyResetToken(token, user);
check('valid token verifies', payload?.uid === 'u123' && payload?.email === 'pm@kodupm.com', payload);

console.log('2) Tampering');
const [body, sig] = token.split('.');
check('bad signature rejected', verifyResetToken(`${body}.${sig.slice(0, -2)}xx`, user) === null);
check('garbage rejected', verifyResetToken('not-a-token', user) === null);
check('empty rejected', verifyResetToken('', user) === null);
const tamperedBody = Buffer.from(JSON.stringify({ uid: 'u999', email: 'evil@x.com', exp: Date.now() + 99999 })).toString('base64url');
check('forged payload rejected', verifyResetToken(`${tamperedBody}.${sig}`, user) === null);

console.log('3) Wrong user rejected');
const other = { ...user, id: 'u999' };
check('token for u123 fails against u999', verifyResetToken(token, other) === null);

console.log('4) Password change invalidates (one-time use)');
const afterChange = { ...user, password: '$2a$12$DIFFERENTHASHxxxxxxxxxxxxxxxxx' };
check('old token dies after password change', verifyResetToken(token, afterChange) === null);

console.log('5) Expiry');
// Craft an expired token with the same key path (simulate by monkey-patching Date)
const realNow = Date.now;
Date.now = () => realNow() - 60 * 60 * 1000; // mint 1h in the past
const expiredToken = createResetToken(user);
Date.now = realNow;
check('expired token rejected', verifyResetToken(expiredToken, user) === null);

if (failures) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAll password-reset tests passed.');
