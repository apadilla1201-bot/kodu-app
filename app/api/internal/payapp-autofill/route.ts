export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ────────────────────────────────────────────────────────────────────────────
// RUTA TEMPORAL — BORRAR DESPUÉS DE USAR.
// 1) Crea la columna directPaymentsCurrent (pago directo del Owner del período).
// 2) Siembra la PA #12 del proyecto 169 (Arena Madness): acumulado oficial del
//    contrato 242,681.21 + pago del período 6,992.50.
// 3) Recalcula el acumulado "Paid by Owner" (7b) de TODAS las Pay Applications:
//    PA[n].directPayments = PA[n-1].directPayments + PA[n-1].directPaymentsCurrent
//    (la PA #12 del 169 queda fija con la cifra oficial).
// ────────────────────────────────────────────────────────────────────────────
const KEY = 'kodupm-migrar-2026';
const SEED_PA12 = 242681.21;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('key') !== KEY) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1) Columna nueva (por si FIX-7B no se subió antes)
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "PayApplication" ADD COLUMN IF NOT EXISTS "directPaymentsCurrent" DOUBLE PRECISION NOT NULL DEFAULT 0',
    );

    // 2) Semilla Arena Madness PA #12: acumulado oficial + período
    const pa12 = await prisma.payApplication.findFirst({
      where: { applicationNumber: 12, project: { projectNumber: '169' } },
    });
    let pa12Seeded = false;
    if (pa12) {
      const needCurrent = ((pa12 as any).directPaymentsCurrent ?? 0) === 0;
      const needAccum = (pa12.directPayments ?? 0) !== SEED_PA12;
      if (needCurrent || needAccum) {
        await prisma.payApplication.update({
          where: { id: pa12.id },
          data: {
            directPayments: SEED_PA12,
            directPaymentsCurrent: 6992.5,
          },
        });
        pa12Seeded = true;
      }
    }

    // 3) Backfill de acumulados en todas las PA
    const projects = await prisma.project.findMany({
      select: { id: true, projectNumber: true },
    });

    const report: any[] = [];

    for (const proj of projects) {
      const pas = await prisma.payApplication.findMany({
        where: { projectId: proj.id },
        orderBy: { applicationNumber: 'asc' },
        select: {
          id: true,
          applicationNumber: true,
          directPayments: true,
          directPaymentsCurrent: true,
        },
      });
      if (pas.length === 0) continue;

      let carry = 0;
      const updates: any[] = [];
      for (const pa of pas) {
        const isArenaPa12 = proj.projectNumber === '169' && pa.applicationNumber === 12;
        if (isArenaPa12) {
          // Cifra oficial del contrato — no se recalcula, queda fija.
          carry = SEED_PA12;
          updates.push({ pa: pa.applicationNumber, action: 'seeded', accum: carry });
        } else if ((pa.directPayments ?? 0) !== carry) {
          await prisma.payApplication.update({
            where: { id: pa.id },
            data: { directPayments: carry },
          });
          updates.push({ pa: pa.applicationNumber, action: 'updated', accum: carry });
        }
        carry = carry + ((pa as any).directPaymentsCurrent ?? 0);
      }
      if (updates.length > 0) {
        report.push({ project: proj.projectNumber, updates });
      }
    }

    return NextResponse.json({
      ok: true,
      column: 'directPaymentsCurrent OK',
      pa12Found: !!pa12,
      pa12Seeded,
      report,
      nextStep:
        'BORRA del repo: app/api/internal/payapp-autofill/route.ts (abrir → menú ⋮ → Delete file → Commit).',
    });
  } catch (error) {
    console.error('payapp-autofill error:', error);
    return NextResponse.json({ ok: false, error: 'Migration failed', detail: String(error) }, { status: 500 });
  }
}
