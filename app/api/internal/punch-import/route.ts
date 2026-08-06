export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// RUTA TEMPORAL — importa la Punch List de Arena Madness
// (112 ítems del Excel Final PunchList Master) — BORRAR DESPUÉS
// Uso: https://app.kodupm.com/api/internal/punch-import?key=kodupm-migrar-2026
// - Busca el proyecto cuyo número o nombre contenga "Arena" (o usa
//   &projectId=... para forzarlo).
// - Respeta itemNumber original (PL-001…PL-112).
// - Fecha identificado = hoy; vencimiento RECALCULADO por prioridad:
//   A = 5 días hábiles, B/C = 10 días hábiles (regla del Excel PDG).
// - No duplica: si ya existen ítems con esos números, los omite.
// ============================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import items from './arena-madness-items.json';

const MIGRATE_KEY = 'kodupm-migrar-2026';

function addWorkdays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== MIGRATE_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const steps: string[] = [];
  try {
    let project = null as any;
    const forced = searchParams.get('projectId');
    if (forced) {
      project = await prisma.project.findUnique({ where: { id: forced } });
    } else {
      project = await prisma.project.findFirst({
        where: {
          OR: [
            { projectName: { contains: 'Arena', mode: 'insensitive' } },
            { projectNumber: { contains: 'Arena', mode: 'insensitive' } },
            { projectNumber: '169' },
          ],
        },
      });
    }
    if (!project) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto Arena no encontrado. Usa &projectId=ID para forzarlo.' },
        { status: 404 },
      );
    }
    steps.push(`proyecto: ${project.projectNumber} — ${project.projectName}`);

    // No duplicar
    const existing = await prisma.punchItem.findMany({
      where: { projectId: project.id },
      select: { itemNumber: true },
    });
    const existingNums = new Set(existing.map((e) => e.itemNumber));

    const today = new Date();
    let created = 0;
    let skipped = 0;
    for (const it of items as any[]) {
      if (existingNums.has(it.n)) {
        skipped++;
        continue;
      }
      const workdays = it.priority === 'A' ? 5 : 10;
      await prisma.punchItem.create({
        data: {
          projectId: project.id,
          itemNumber: it.n,
          title: it.deficiency.slice(0, 300),
          description: it.deficiency.length > 300 ? it.deficiency : null,
          correctiveAction: it.corrective || null,
          area: it.area || null,
          location: it.location || null,
          trade: it.trade || null,
          assignedToName: it.sub && !it.sub.toUpperCase().includes('TBD') ? it.sub : null,
          priority: it.priority,
          status: 'Open',
          dueDate: addWorkdays(today, workdays),
          identifiedBy: 'Importado del Excel Final PunchList (S. Estrada walk 15-jul)',
          notes: it.notes || null,
          externalToken: randomBytes(24).toString('hex'),
        },
      });
      created++;
    }
    steps.push(`ítems creados: ${created}, omitidos (ya existían): ${skipped}`);

    return NextResponse.json({
      ok: true,
      steps,
      recordatorio: 'BORRA la carpeta app/api/internal/punch-import/ del repo AHORA.',
    });
  } catch (error: any) {
    console.error('punch-import error:', error);
    return NextResponse.json({ ok: false, steps, error: error?.message }, { status: 500 });
  }
}
