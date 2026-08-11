export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * MIGRACIÓN TEMPORAL (v22) — BORRAR ESTA CARPETA DESPUÉS DE USARLA.
 * Crea: Project.accessKey + tabla ProjectAccess.
 * Ejecutar: GET /api/internal/project-access-migrate?key=kodupm-migrar-2026
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== 'kodupm-migrar-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // 1. Columna accessKey en Project
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "accessKey" TEXT;`
    );

    // 2. Tabla ProjectAccess
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProjectAccess" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ProjectAccess_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAccess_userId_projectId_key" ON "ProjectAccess"("userId", "projectId");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ProjectAccess_userId_idx" ON "ProjectAccess"("userId");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ProjectAccess_projectId_idx" ON "ProjectAccess"("projectId");`
    );

    // 3. FKs (idempotente)
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAccess_userId_fkey'
        ) THEN
          ALTER TABLE "ProjectAccess"
            ADD CONSTRAINT "ProjectAccess_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAccess_projectId_fkey'
        ) THEN
          ALTER TABLE "ProjectAccess"
            ADD CONSTRAINT "ProjectAccess_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    // 4. Verificación
    const cols: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'ProjectAccess' ORDER BY ordinal_position;`
    );
    const pk: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'Project' AND column_name = 'accessKey';`
    );

    return NextResponse.json({
      ok: true,
      projectAccessColumns: cols.map((c) => c.column_name),
      projectHasAccessKey: pk.length > 0,
      note: 'BORRA app/api/internal del repo ahora mismo.',
    });
  } catch (error: any) {
    console.error('project-access-migrate error:', error);
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 });
  }
}
