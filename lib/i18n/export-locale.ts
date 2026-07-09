import type { AppLocale } from './types';

export function exportDateLocale(locale: AppLocale): string {
  return locale === 'es' ? 'es-US' : 'en-US';
}

export function exportNumberLocale(locale: AppLocale): string {
  return locale === 'es' ? 'es-US' : 'en-US';
}
