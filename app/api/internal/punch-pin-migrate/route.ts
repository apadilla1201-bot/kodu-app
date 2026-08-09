   export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// RUTA TEMPORAL — borrar app/api/internal/ del repo después de correrla.
// Agrega pinX/pinY a PunchItem (chinchetas del punch list sobre planos). Idempotente.
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  if (key !== 'kodupm-migrar-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "pinX" double precision`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "pinY" double precision`);
    const cols = await prisma.$queryRawUnsafe<any[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'PunchItem' AND column_name IN ('pinX','pinY') ORDER BY column_name`
    );
    return NextResponse.json({ ok: true, columns: cols.map((c) => c.column_name) });
  } catch (error: any) {
    console.error('punch-pin-migrate error:', error);
    return NextResponse.json({ error: String(error?.message ?? 'migration failed') }, { status: 500 });
  }
}
