/**
 * Public app URL for links in emails, PDFs, and file downloads.
 * In production always uses app.kodupm.com so emails never point at the wrong domain.
 */
const PRODUCTION_APP_URL = 'https://app.kodupm.com';

export function appBaseUrl(): string {
  // Production: always app.kodupm.com — never trust NEXTAUTH_URL alone (often mis-set to *.vercel.app).
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    return PRODUCTION_APP_URL;
  }

  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) {
    try {
      const host = new URL(nextAuth).hostname;
      if (
        host === 'app.kodupm.com' ||
        host.endsWith('.vercel.app') ||
        host === 'localhost' ||
        host === '127.0.0.1'
      ) {
        return nextAuth.replace(/\/$/, '');
      }
    } catch {
      /* ignore invalid URL */
    }
  }

  return (nextAuth || 'http://localhost:3000').replace(/\/$/, '');
}
