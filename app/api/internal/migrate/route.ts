export const dynamic = 'force-dynamic';

// ============================================================
// RUTA TEMPORAL DE MIGRACIÓN — BORRAR ESTE ARCHIVO DESPUÉS DE USARLA
// ============================================================
// Actualización 2026-07-28 (paquete 3 — invitaciones y roles):
//   NUEVAS TABLAS: ProjectMember, UserInvite (+ índices y FKs)
// (Incluye también las columnas de paquetes 1 y 2 por si acaso.)
// Idempotente (IF NOT EXISTS): se puede ejecutar varias veces sin riesgo
// y NO borra ni modifica datos existentes.
//
// Uso: https://app.kodupm.com/api/internal/migrate?key=TU_CLAVE
// ============================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_KEY = 'kodupm-migrar-2026';

const STATEMENTS: { label: string; sql: string }[] = [
  // ---- Paquete 3: tablas de equipo ----
  {
    label: 'Tabla ProjectMember',
    sql: `CREATE TABLE IF NOT EXISTS "ProjectMember" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "projectId" TEXT,
      "role" TEXT NOT NULL DEFAULT 'viewer',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
    )`,
  },
  { label: 'Índice único ProjectMember(userId,projectId)', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_userId_projectId_key" ON "ProjectMember"("userId", "projectId")' },
  { label: 'Índice ProjectMember.userId', sql: 'CREATE INDEX IF NOT EXISTS "ProjectMember_userId_idx" ON "ProjectMember"("userId")' },
  { label: 'Índice ProjectMember.projectId', sql: 'CREATE INDEX IF NOT EXISTS "ProjectMember_projectId_idx" ON "ProjectMember"("projectId")' },
  {
    label: 'Tabla UserInvite',
    sql: `CREATE TABLE IF NOT EXISTS "UserInvite" (
      "id" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "name" TEXT,
      "role" TEXT NOT NULL DEFAULT 'viewer',
      "projectId" TEXT,
      "token" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "invitedBy" TEXT,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
    )`,
  },
  { label: 'Índice único UserInvite.token', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "UserInvite_token_key" ON "UserInvite"("token")' },
  { label: 'Índice UserInvite.companyId', sql: 'CREATE INDEX IF NOT EXISTS "UserInvite_companyId_idx" ON "UserInvite"("companyId")' },
  { label: 'Índice UserInvite.email', sql: 'CREATE INDEX IF NOT EXISTS "UserInvite_email_idx" ON "UserInvite"("email")' },
  // FKs (DO block para no fallar si ya existen)
  {
    label: 'FK ProjectMember a User',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_userId_fkey') THEN
        ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
  },
  {
    label: 'FK ProjectMember a Project',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_projectId_fkey') THEN
        ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
  },
  {
    label: 'FK UserInvite a Company',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserInvite_companyId_fkey') THEN
        ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
  },
  {
    label: 'FK UserInvite a Project',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserInvite_projectId_fkey') THEN
        ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
  },
  {
    label: 'FK UserInvite a User (inviter)',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserInvite_invitedBy_fkey') THEN
        ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`,
  },
  // ---- Paquetes 1 y 2 (por si alguna quedó pendiente) ----
  { label: 'RFI.decisionToken', sql: 'ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "decisionToken" TEXT' },
  { label: 'Índice único RFI.decisionToken', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "RFI_decisionToken_key" ON "RFI"("decisionToken")' },
  { label: 'Submittal.decisionToken', sql: 'ALTER TABLE "Submittal" ADD COLUMN IF NOT EXISTS "decisionToken" TEXT' },
  { label: 'Índice único Submittal.decisionToken', sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "Submittal_decisionToken_key" ON "Submittal"("decisionToken")' },
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

  let tablesVerified: string[] = [];
  try {
    const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('ProjectMember', 'UserInvite')
      ORDER BY table_name
    `);
    tablesVerified = rows.map((r) => r.table_name);
  } catch {
    /* verificación informativa */
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    mensaje:
      failed.length === 0
        ? 'Migración completada. IMPORTANTE: borra ahora el archivo app/api/internal/migrate/route.ts del repositorio.'
        : 'Algunos pasos fallaron — copia este resultado y envíalo a soporte.',
    pasos: results,
    tablasVerificadas: tablesVerified,
  });
}
