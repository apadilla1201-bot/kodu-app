export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isAppLocale } from '@/lib/i18n/types';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        locale: true,
        companyId: true,
        company: { select: { id: true, name: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error: any) {
    console.error('GET /api/user/profile error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = String(body.name).trim() || null;
    if (body.role !== undefined) {
      const role = String(body.role);
      if (!['owner', 'pm', 'estimator', 'viewer', 'user'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      data.role = role;
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      }
      const taken = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (taken) return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      data.email = email;
    }
    if (body.password) {
      if (String(body.password).length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      data.password = await bcrypt.hash(String(body.password), 10);
    }
    if (body.locale !== undefined) {
      const locale = String(body.locale);
      if (!isAppLocale(locale)) {
        return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
      }
      data.locale = locale;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        locale: true,
        companyId: true,
        company: { select: { id: true, name: true } },
      },
    });

    const response = NextResponse.json(user);
    if (typeof data.locale === 'string') {
      response.cookies.set('kodu_locale', data.locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }
    return response;
  } catch (error: any) {
    console.error('PATCH /api/user/profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
