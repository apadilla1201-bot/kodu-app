export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// RUTA TEMPORAL — migración LienWaiver (BORRAR DESPUÉS DE USAR)
// Uso: https://app.kodupm.com/api/internal/lien-waivers-migrate?key=kodupm-migrar-2026
// Crea la tabla LienWaiver + índices + llaves foráneas.
// Cuando responda ok:true, BORRA este archivo del repo.
// ============================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MIGRATE_KEY = 'kodupm-migrar-2026';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== MIGRATE_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const steps: string[] = [];
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LienWaiver" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "payApplicationId" TEXT,
        "subcontractor" TEXT NOT NULL,
        "subEmail" TEXT,
        "waiverType" TEXT NOT NULL DEFAULT 'conditional_progress',
        "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "throughDate" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'Pending',
        "fileUrl" TEXT,
        "fileName" TEXT,
        "externalToken" TEXT,
        "sentAt" TIMESTAMP(3),
        "receivedAt" TIMESTAMP(3),
        "notes" TEXT,
        "createdByName" TEXT,
        "createdByEmail" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "LienWaiver_pkey" PRIMARY KEY ("id")
      )
    `);
    steps.push('tabla LienWaiver creada (o ya existía)');

    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "LienWaiver_externalToken_key" ON "LienWaiver"("externalToken")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "LienWaiver_projectId_idx" ON "LienWaiver"("projectId")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "LienWaiver_payApplicationId_idx" ON "LienWaiver"("payApplicationId")'
    );
    steps.push('índices creados');

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LienWaiver_projectId_fkey') THEN
          ALTER TABLE "LienWaiver"
            ADD CONSTRAINT "LienWaiver_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LienWaiver_payApplicationId_fkey') THEN
          ALTER TABLE "LienWaiver"
            ADD CONSTRAINT "LienWaiver_payApplicationId_fkey"
            FOREIGN KEY ("payApplicationId") REFERENCES "PayApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    steps.push('llaves foráneas verificadas');

    const check: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'LienWaiver' ORDER BY ordinal_position`
    );
    steps.push(`columnas verificadas: ${check.map((c) => c.column_name).join(', ')}`);

    return NextResponse.json({
      ok: true,
      steps,
      recordatorio: 'BORRA app/api/internal/lien-waivers-migrate/route.ts del repo AHORA.',
    });
  } catch (error: any) {
    console.error('lien-waivers-migrate error:', error);
    return NextResponse.json({ ok: false, steps, error: error?.message }, { status: 500 });
  }
}
