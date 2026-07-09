'use client';

import { useLocaleContext } from '@/components/locale-provider';
import { createTranslator } from '@/lib/i18n';
import type { AppLocale, MessageParams } from '@/lib/i18n';

export function useLocale(): {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => Promise<void>;
} {
  const { locale, setLocale } = useLocaleContext();
  return { locale, setLocale };
}

export function useI18n() {
  const { locale, setLocale } = useLocaleContext();
  const t = (key: string, params?: MessageParams) => createTranslator(locale)(key, params);
  return { locale, setLocale, t };
}
