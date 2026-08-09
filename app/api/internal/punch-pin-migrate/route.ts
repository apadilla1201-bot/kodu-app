     1	export const dynamic = 'force-dynamic';
     2	
     3	import { NextResponse } from 'next/server';
     4	import { prisma } from '@/lib/prisma';
     5	
     6	// RUTA TEMPORAL — borrar app/api/internal/ del repo después de correrla.
     7	// Agrega pinX/pinY a PunchItem (chinchetas del punch list sobre planos). Idempotente.
     8	export async function GET(request: Request) {
     9	  const key = new URL(request.url).searchParams.get('key');
    10	  if (key !== 'kodupm-migrar-2026') {
    11	    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    12	  }
    13	  try {
    14	    await prisma.$executeRawUnsafe(`ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "pinX" double precision`);
    15	    await prisma.$executeRawUnsafe(`ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "pinY" double precision`);
    16	    const cols = await prisma.$queryRawUnsafe<any[]>(
    17	      `SELECT column_name FROM information_schema.columns WHERE table_name = 'PunchItem' AND column_name IN ('pinX','pinY') ORDER BY column_name`
    18	    );
    19	    return NextResponse.json({ ok: true, columns: cols.map((c) => c.column_name) });
    20	  } catch (error: any) {
    21	    console.error('punch-pin-migrate error:', error);
    22	    return NextResponse.json({ error: String(error?.message ?? 'migration failed') }, { status: 500 });
    23	  }
    24	}
    25	
