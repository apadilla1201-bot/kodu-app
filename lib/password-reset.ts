/**
 * Stateless password-reset tokens (HMAC-SHA256, no DB table needed).
 *
 * Design:
 * - Payload: { uid, email, exp } — 30 minute expiry.
 * - Signing key: NEXTAUTH_SECRET + a slice of the user's CURRENT password
 *   hash. Consequences:
 *     · the token dies as soon as the password changes (one-time use);
 *     · only someone with server secrets can mint tokens.
 * - No token storage required, so no Prisma migration is needed.
 */
import crypto from 'crypto';

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface ResetPayload {
  uid: string;
  email: string;
  exp: number;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function signingKey(passwordHashSlice: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'kodu-dev-secret';
  return `${secret}:${passwordHashSlice}`;
}

function sign(data: string, passwordHashSlice: string): string {
  return crypto.createHmac('sha256', signingKey(passwordHashSlice)).update(data).digest('base64url');
}

export function createResetToken(user: { id: string; email: string; password: string }): string {
  const payload: ResetPayload = {
    uid: user.id,
    email: user.email,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const slice = user.password.slice(0, 16);
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, slice)}`;
}

/**
 * Verify a token against the user's CURRENT password hash.
 * Returns the payload if valid, null otherwise.
 */
export function verifyResetToken(
  token: string,
  user: { id: string; email: string; password: string },
): ResetPayload | null {
  try {
    const [body, signature] = token.split('.');
    if (!body || !signature) return null;

    const slice = user.password.slice(0, 16);
    const expected = sign(body, slice);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as ResetPayload;
    if (!payload.uid || payload.uid !== user.id) return null;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
