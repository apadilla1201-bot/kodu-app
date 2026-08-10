export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// RUTA TEMPORAL — migración SubInvoice (BORRAR DESPUÉS DE USAR)
// Uso: https://app.kodupm.com/api/internal/sub-invoices-migrate?key=kodupm-migrar-2026
// Crea la tabla SubInvoice + índices + llave foránea.
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
      CREATE TABLE IF NOT EXISTS "SubInvoice" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "subcontractor" TEXT NOT NULL,
        "invoiceNumber" TEXT,
        "description" TEXT,
        "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "retainagePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
        "netAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "costCode" TEXT,
        "costCodeLabel" TEXT,
        "fileUrl" TEXT,
        "fileName" TEXT,
        "stampedFileUrl" TEXT,
        "stampedFileName" TEXT,
        "status" TEXT NOT NULL DEFAULT 'Pending',
        "sentToEmail" TEXT,
        "sentAt" TIMESTAMP(3),
        "notes" TEXT,
        "createdByName" TEXT,
        "createdByEmail" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "SubInvoice_pkey" PRIMARY KEY ("id")
      )
    `);
    steps.push('tabla SubInvoice creada (o ya existía)');

    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "SubInvoice_projectId_idx" ON "SubInvoice"("projectId")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "SubInvoice_status_idx" ON "SubInvoice"("status")'
    );
    steps.push('índices creados');

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubInvoice_projectId_fkey') THEN
          ALTER TABLE "SubInvoice"
            ADD CONSTRAINT "SubInvoice_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    steps.push('llave foránea verificada');

    const check: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'SubInvoice' ORDER BY ordinal_position`
    );
    steps.push(`columnas verificadas: ${check.map((c) => c.column_name).join(', ')}`);

    return NextResponse.json({
      ok: true,
      steps,
      recordatorio: 'BORRA la carpeta app/api/internal del repo AHORA.',
    });
  } catch (error: any) {
    console.error('sub-invoices-migrate error:', error);
    return NextResponse.json({ ok: false, steps, error: error?.message }, { status: 500 });
  }
}
