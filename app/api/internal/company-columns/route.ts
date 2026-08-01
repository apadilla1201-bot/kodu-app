export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ────────────────────────────────────────────────────────────────────────────
// RUTA TEMPORAL — BORRAR DESPUÉS DE USAR (LEEME paso 3).
// Agrega las columnas addressCity y license a la tabla Company y siembra
// los datos reales de The Project Delivery Group LLC para los reportes.
// ────────────────────────────────────────────────────────────────────────────
const KEY = 'kodupm-migrar-2026';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('key') !== KEY) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const done: string[] = [];
    await prisma.$executeRawUnsafe('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "addressCity" TEXT');
    done.push('columna addressCity: OK');
    await prisma.$executeRawUnsafe('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "license" TEXT');
    done.push('columna license: OK');

    const pdg = await prisma.company.findFirst({
      where: { name: { contains: 'project delivery group', mode: 'insensitive' } },
    });
    let seeded = false;
    if (pdg && !pdg.address) {
      await prisma.company.update({
        where: { id: pdg.id },
        data: {
          address: '7255 NE 4th Ave, Suite 110-2',
          addressCity: 'Miami, FL 33138',
          phone: '(772) 766-9399',
          website: 'www.projectdeliverygroup.com',
          license: 'CGC1530498',
        },
      });
      seeded = true;
    }

    return NextResponse.json({
      ok: true,
      done,
      pdgFound: !!pdg,
      pdgSeeded: seeded,
      nextStep:
        'AHORA BORRA este archivo del repo en GitHub: app/api/internal/company-columns/route.ts (abrir archivo → menú ⋮ → Delete file → Commit).',
    });
  } catch (error) {
    console.error('company-columns error:', error);
    return NextResponse.json({ ok: false, error: 'Migration failed', detail: String(error) }, { status: 500 });
  }
}
