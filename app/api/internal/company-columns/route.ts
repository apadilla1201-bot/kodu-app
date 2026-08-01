export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ────────────────────────────────────────────────────────────────────────────
// RUTA TEMPORAL v2 — BORRAR DESPUÉS DE USAR.
// Rellena SOLO los campos vacíos de The Project Delivery Group LLC
// (address, addressCity, phone, website, license), uno por uno.
// ────────────────────────────────────────────────────────────────────────────
const KEY = 'kodupm-migrar-2026';

const PDG_DATA: Record<string, string> = {
  address: '7255 NE 4th Ave, Suite 110-2',
  addressCity: 'Miami, FL 33138',
  phone: '(772) 766-9399',
  website: 'www.projectdeliverygroup.com',
  license: 'CGC1530498',
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('key') !== KEY) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.$executeRawUnsafe('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "addressCity" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "license" TEXT');

    const pdg = await prisma.company.findFirst({
      where: { name: { contains: 'project delivery group', mode: 'insensitive' } },
    });
    if (!pdg) {
      return NextResponse.json({ ok: false, error: 'PDG company not found' }, { status: 404 });
    }

    const current = pdg as unknown as Record<string, string | null>;
    const toFill: Record<string, string> = {};
    for (const [field, value] of Object.entries(PDG_DATA)) {
      if (!current[field] || !String(current[field]).trim()) toFill[field] = value;
    }

    if (Object.keys(toFill).length > 0) {
      await prisma.company.update({ where: { id: pdg.id }, data: toFill });
    }

    const after = await prisma.company.findUnique({
      where: { id: pdg.id },
      select: { address: true, addressCity: true, phone: true, website: true, license: true },
    });

    return NextResponse.json({
      ok: true,
      filledFields: Object.keys(toFill),
      pdg: after,
      nextStep:
        'BORRA del repo en GitHub: app/api/internal/company-columns/route.ts Y TAMBIÉN app/api/internal/set-owner/route.ts (quedó de antes). Abrir archivo → menú ⋮ → Delete file → Commit.',
    });
  } catch (error) {
    console.error('company-columns error:', error);
    return NextResponse.json({ ok: false, error: 'Migration failed', detail: String(error) }, { status: 500 });
  }
}
