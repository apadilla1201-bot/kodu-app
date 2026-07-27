export const dynamic = 'force-dynamic';

// ============================================================
// RUTA TEMPORAL DE MIGRACIÓN — BORRAR ESTE ARCHIVO DESPUÉS DE USARLA
// ============================================================
// Aplica los campos nuevos de la actualización 2026-07-27:
//   Submittal:   externalToken, responseText, responseBy, responseDate
//   ChangeOrder: ownerName, ownerEmail, externalToken, decidedBy
// Es idempotente (IF NOT EXISTS): se puede ejecutar varias veces sin riesgo
// y NO borra ni modifica datos existentes.
//
// Uso: visitar en el navegador
//   https://app.kodupm.com/api/internal/migrate?key=TU_CLAVE
// La clave es la variable MIGRATE_KEY en Vercel; si no existe,
// se usa la clave temporal por defecto de abajo.
// ============================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_KEY = 'kodupm-migrar-2026';

const STATEMENTS: { label: string; sql: string }[] = [
  { label: 'Submittal.externalToken', sql: 'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "externalToken" TEXT' },
  { label: 'Submittal.responseText', sql: 'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "responseText" TEXT' },
  { label: 'Submittal.responseBy', sql: 'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "responseBy" TEXT' },
  { label: 'Submittal.responseDate', sql: 'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "responseDate" TIMESTAMP(3)' },
  { label: 'Índice único Submittal.externalToken', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "Submittal_externalToken_key" ON "Submittal"("externalToken")' },
  { label: 'ChangeOrder.ownerName', sql: 'ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "ownerName" TEXT' },
  { label: 'ChangeOrder.ownerEmail', sql: 'ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT' },
  { label: 'ChangeOrder.externalToken', sql: 'ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "externalToken" TEXT' },
  { label: 'ChangeOrder.decidedBy', sql: 'ALTER TABLE "ChangeOrder" ADD COLUMN IF NOT EXISTS "decidedBy" TEXT' },
  { label: 'Índice único ChangeOrder.externalToken', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "ChangeOrder_externalToken_key" ON "ChangeOrder"("externalToken")' },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key') ?? '';
  const expected = process.env.MIGRATE_KEY?.trim() || DEFAULT_KEY;

  if (key !== expected) {
    return NextResponse.json(
      { ok: false, error: 'Clave incorrecta. Uso: /api/internal/migrate?key=TU_CLAVE' },
      { status: 401 },
    );
  }

  const results: { label: string; ok: boolean; error?: string }[] = [];

  for (const stmt of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt.sql);
      results.push({ label: stmt.label, ok: true });
    } catch (err: any) {
      results.push({ label: stmt.label, ok: false, error: String(err?.message ?? err) });
    }
  }

  // Verificación: listar las columnas que deberían existir
  let verified: { table_name: string; column_name: string }[] = [];
  try {
    verified = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_name IN ('Submittal', 'ChangeOrder')
        AND column_name IN ('externalToken', 'responseText', 'responseBy', 'responseDate', 'ownerName', 'ownerEmail', 'decidedBy')
      ORDER BY table_name, column_name
    `);
  } catch {
    /* la verificación es informativa; no bloquea */
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    mensaje:
      failed.length === 0
        ? 'Migración completada. IMPORTANTE: borra ahora el archivo app/api/internal/migrate/route.ts del repositorio.'
        : 'Algunos pasos fallaron — copia este resultado y envíalo a soporte.',
    pasos: results,
    columnasVerificadas: verified,
  });
}
