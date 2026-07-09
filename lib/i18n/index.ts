import { enMessages, type MessageTree, type Messages } from './messages/en';
import { esMessages } from './messages/es';
import type { AppLocale, MessageParams } from './types';
import { DEFAULT_LOCALE, isAppLocale } from './types';

export * from './types';

const catalogs: Record<AppLocale, MessageTree> = {
  en: enMessages as MessageTree,
  es: esMessages as MessageTree,
};

function getNestedValue(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function createTranslator(locale: AppLocale) {
  const messages = catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
  return function t(key: string, params?: MessageParams): string {
    const value = getNestedValue(messages, key) ?? getNestedValue(catalogs.en, key);
    if (!value) return key;
    return interpolate(value, params);
  };
}

export function getMessages(locale: AppLocale): MessageTree {
  return catalogs[isAppLocale(locale) ? locale : DEFAULT_LOCALE];
}

export function formatDateLocale(
  value: Date | string | number,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(locale === 'es' ? 'es-US' : 'en-US', options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrencyLocale(
  value: number,
  locale: AppLocale,
  currency = 'USD',
): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

export function photoTagLabelForLocale(tag: string, locale: AppLocale): string {
  const key = `photoTags.${tag}` as const;
  const t = createTranslator(locale);
  const translated = t(key);
  return translated === key ? tag : translated;
}
