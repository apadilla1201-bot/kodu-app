export type AppLocale = 'en' | 'es';

export const DEFAULT_LOCALE: AppLocale = 'en';
export const LOCALE_COOKIE = 'kodu_locale';

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en' || value === 'es';
}

export type MessageParams = Record<string, string | number | undefined>;
