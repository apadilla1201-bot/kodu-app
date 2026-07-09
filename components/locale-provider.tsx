'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSession } from 'next-auth/react';
import type { AppLocale } from '@/lib/i18n';
import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE } from '@/lib/i18n/types';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => Promise<void>;
  ready: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookieLocale(): AppLocale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  const value = match?.split('=')[1];
  return isAppLocale(value) ? value : null;
}

function writeCookieLocale(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [locale, setLocaleState] = useState<AppLocale>(readCookieLocale() ?? DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (status === 'loading') return;
    (async () => {
      try {
        if (status === 'authenticated') {
          const res = await fetch('/api/user/profile', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (isAppLocale(data.locale)) {
              setLocaleState(data.locale);
              writeCookieLocale(data.locale);
            }
          }
        } else {
          const fromCookie = readCookieLocale();
          if (fromCookie) setLocaleState(fromCookie);
        }
      } finally {
        setReady(true);
      }
    })();
  }, [status]);

  const setLocale = useCallback(async (next: AppLocale) => {
    setLocaleState(next);
    writeCookieLocale(next);
    document.documentElement.lang = next;
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locale: next }),
      });
    } catch {
      // cookie still applies for guests; logged-in users can retry from settings
    }
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, ready }),
    [locale, setLocale, ready],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocaleContext must be used within LocaleProvider');
  }
  return ctx;
}
