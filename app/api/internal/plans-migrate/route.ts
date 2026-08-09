export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN TEMPORAL — Plan Room (drawing log + revisiones)
// URL: /api/internal/plans-migrate?key=kodupm-migrar-2026
// Idempotente. BORRAR ESTA CARPETA DEL REPO DESPUÉS DE CORRERLA.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'kodupm-migrar-2026';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== KEY) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 });
  }

  const { prisma } = await import('@/lib/prisma');
  const steps: string[] = [];

  try {
    // ── PlanSet ──────────────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PlanSet" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "setType" TEXT NOT NULL DEFAULT 'Original',
        "issueDate" TIMESTAMP(3),
        "notes" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PlanSet_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PlanSet_projectId_idx" ON "PlanSet"("projectId")`);
    steps.push('tabla PlanSet creada (o ya existía)');

    // ── PlanSheet ────────────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PlanSheet" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "planSetId" TEXT,
        "sheetNumber" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "discipline" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PlanSheet_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PlanSheet_projectId_sheetNumber_key" ON "PlanSheet"("projectId", "sheetNumber")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PlanSheet_projectId_idx" ON "PlanSheet"("projectId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PlanSheet_planSetId_idx" ON "PlanSheet"("planSetId")`);
    steps.push('tabla PlanSheet creada (o ya existía)');

    // ── PlanRevision ─────────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PlanRevision" (
        "id" TEXT NOT NULL,
        "planSheetId" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "revisionDate" TIMESTAMP(3),
        "fileUrl" TEXT,
        "fileName" TEXT,
        "fileIsPublic" BOOLEAN NOT NULL DEFAULT false,
        "isCurrent" BOOLEAN NOT NULL DEFAULT true,
        "uploadedByName" TEXT,
        "uploadedByEmail" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PlanRevision_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PlanRevision_planSheetId_idx" ON "PlanRevision"("planSheetId")`);
    steps.push('tabla PlanRevision creada (o ya existía)');

    // ── Llaves foráneas (idempotente con DO $$) ──────────────────────────
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanSet_projectId_fkey') THEN
          ALTER TABLE "PlanSet" ADD CONSTRAINT "PlanSet_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanSheet_projectId_fkey') THEN
          ALTER TABLE "PlanSheet" ADD CONSTRAINT "PlanSheet_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanSheet_planSetId_fkey') THEN
          ALTER TABLE "PlanSheet" ADD CONSTRAINT "PlanSheet_planSetId_fkey"
            FOREIGN KEY ("planSetId") REFERENCES "PlanSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanRevision_planSheetId_fkey') THEN
          ALTER TABLE "PlanRevision" ADD CONSTRAINT "PlanRevision_planSheetId_fkey"
            FOREIGN KEY ("planSheetId") REFERENCES "PlanSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    steps.push('llaves foráneas verificadas');

    // ── Columnas de vínculo en documentos existentes ─────────────────────
    await prisma.$executeRawUnsafe(`ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "planSheetId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "drawingRef" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "planSheetId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "planSheetId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "planSheetId" TEXT`);
    steps.push('columnas planSheetId/drawingRef agregadas en RFI, ChangeOrder, Submittal, PunchItem');

    return NextResponse.json({
      ok: true,
      steps,
      recordatorio: 'BORRA app/api/internal/plans-migrate/route.ts del repo AHORA.',
    });
  } catch (error: any) {
    console.error('plans-migrate error:', error);
    return NextResponse.json({ ok: false, steps, error: error?.message ?? String(error) }, { status: 500 });
  }
}
