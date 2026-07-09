import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { createTranslator, type AppLocale } from '@/lib/i18n';
import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE } from '@/lib/i18n/types';

export async function getUserLocale(userId?: string | null): Promise<AppLocale> {
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true },
      });
      if (user?.locale && isAppLocale(user.locale)) return user.locale;
    } catch {
      // fall through to cookie/default
    }
  }
  try {
    const cookieStore = cookies();
    const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
    if (isAppLocale(fromCookie)) return fromCookie;
  } catch {
    // cookies() unavailable outside request
  }
  return DEFAULT_LOCALE;
}

export async function getSessionLocale(): Promise<AppLocale> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  return getUserLocale(userId);
}

export async function getRequestLocale(request?: Request): Promise<AppLocale> {
  if (request) {
    const header = request.headers.get('x-kodu-locale');
    if (isAppLocale(header)) return header;
    try {
      const body = await request.clone().json();
      if (isAppLocale(body?.locale)) return body.locale;
    } catch {
      // no JSON body
    }
  }
  return getSessionLocale();
}

export async function getServerTranslator(request?: Request) {
  const locale = await getRequestLocale(request);
  return { locale, t: createTranslator(locale) };
}
