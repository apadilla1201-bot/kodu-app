export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// RUTA TEMPORAL — migración PunchItem v2 (BORRAR DESPUÉS DE USAR)
// Uso: https://app.kodupm.com/api/internal/punch-migrate?key=kodupm-migrar-2026
// Crea la tabla PunchItem si no existe Y agrega las columnas v2
// (area, correctiveAction, identifiedBy, backCharge) si faltan.
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
      CREATE TABLE IF NOT EXISTS "PunchItem" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "itemNumber" INTEGER NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "location" TEXT,
        "trade" TEXT,
        "assignedToName" TEXT,
        "assignedToEmail" TEXT,
        "priority" TEXT NOT NULL DEFAULT 'Medium',
        "status" TEXT NOT NULL DEFAULT 'Open',
        "dueDate" TIMESTAMP(3),
        "photoUrl" TEXT,
        "photoName" TEXT,
        "completionPhotoUrl" TEXT,
        "completionPhotoName" TEXT,
        "externalToken" TEXT,
        "sentAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "completedByName" TEXT,
        "notes" TEXT,
        "createdByName" TEXT,
        "createdByEmail" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PunchItem_pkey" PRIMARY KEY ("id")
      )
    `);
    steps.push('tabla PunchItem creada (o ya existía)');

    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "PunchItem_externalToken_key" ON "PunchItem"("externalToken")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PunchItem_projectId_idx" ON "PunchItem"("projectId")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PunchItem_status_idx" ON "PunchItem"("status")'
    );
    steps.push('índices creados');

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PunchItem_projectId_fkey') THEN
          ALTER TABLE "PunchItem"
            ADD CONSTRAINT "PunchItem_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    steps.push('llave foránea verificada');

    // Columnas v2 (idempotentes — IF NOT EXISTS)
    await prisma.$executeRawUnsafe('ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "area" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "correctiveAction" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "identifiedBy" TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE "PunchItem" ADD COLUMN IF NOT EXISTS "backCharge" DOUBLE PRECISION');
    steps.push('columnas v2 agregadas (area, correctiveAction, identifiedBy, backCharge)');

    // Tabla v3: firmas por área (SIGNOFF — soporte AIA G704)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PunchAreaSignoff" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "area" TEXT NOT NULL,
        "superName" TEXT,
        "pmName" TEXT,
        "ownerRepName" TEXT,
        "signedByName" TEXT,
        "signedByEmail" TEXT,
        "remarks" TEXT,
        "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PunchAreaSignoff_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "PunchAreaSignoff_projectId_area_key" ON "PunchAreaSignoff"("projectId", "area")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PunchAreaSignoff_projectId_idx" ON "PunchAreaSignoff"("projectId")'
    );
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PunchAreaSignoff_projectId_fkey') THEN
          ALTER TABLE "PunchAreaSignoff"
            ADD CONSTRAINT "PunchAreaSignoff_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    steps.push('tabla PunchAreaSignoff creada (signoff por área)');

    // Tabla v4: entregables de closeout
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CloseoutItem" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "category" TEXT NOT NULL,
        "deliverable" TEXT NOT NULL,
        "responsible" TEXT,
        "status" TEXT NOT NULL DEFAULT 'Pending',
        "dateReceived" TIMESTAMP(3),
        "fileUrl" TEXT,
        "fileName" TEXT,
        "externalToken" TEXT,
        "requestedTo" TEXT,
        "requestedAt" TIMESTAMP(3),
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CloseoutItem_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "CloseoutItem_externalToken_key" ON "CloseoutItem"("externalToken")'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "CloseoutItem_projectId_idx" ON "CloseoutItem"("projectId")'
    );
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CloseoutItem_projectId_fkey') THEN
          ALTER TABLE "CloseoutItem"
            ADD CONSTRAINT "CloseoutItem_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    steps.push('tabla CloseoutItem creada (entregables de cierre)');

    const check: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'PunchItem' ORDER BY ordinal_position`
    );
    steps.push(`columnas verificadas: ${check.map((c) => c.column_name).join(', ')}`);
    const check2: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'PunchAreaSignoff' ORDER BY ordinal_position`
    );
    steps.push(`signoff columnas: ${check2.map((c) => c.column_name).join(', ')}`);

    return NextResponse.json({
      ok: true,
      steps,
      recordatorio: 'BORRA app/api/internal/punch-migrate/route.ts del repo AHORA.',
    });
  } catch (error: any) {
    console.error('punch-migrate error:', error);
    return NextResponse.json({ ok: false, steps, error: error?.message }, { status: 500 });
  }
}
