export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * One-time migration: add User.locale for i18n.
 * POST with session, ?secret=, or X-Migrate-Once bootstrap header.
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') ?? '';
    const expected =
      process.env.MIGRATE_SECRET || process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || '';

    const session = await getServerSession(authOptions);
    const bootstrap = request.headers.get('x-migrate-once') === 'kodu-locale-2026';
    const authorizedBySession = Boolean(session?.user);
    const authorizedBySecret = Boolean(expected) && secret === expected;
    const authorized = authorizedBySession || authorizedBySecret || bootstrap;

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';
    `);

    const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'locale'`,
    );

    return NextResponse.json({
      ok: true,
      message: 'User.locale column ready',
      column: rows[0] ?? null,
    });
  } catch (error: unknown) {
    console.error('migrate-user-locale error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 },
    );
  }
}
