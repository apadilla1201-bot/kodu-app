export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET /api/analytics/projected-cashflow?projectId=X
// Base real para la proyeccion al fin de la obra, POR DIVISION:
// - Divisions presentes en el ultimo PA: revised/executed desde el PA (sus columnas de
//   change orders ya llevan las CORs aprobadas — misma regla anti doble carga del Buy Out)
// - Divisiones sin PA: scheduled del Budget + CORs aprobadas (match CSI 2 digitos)
// - CORs pendientes/rechazadas nunca se incluyen
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session?.user as any)?.companyId ?? '';
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const latestPa = await prisma.payApplication.findFirst({
    where: { projectId },
    orderBy: { applicationNumber: 'desc' },
    include: { lineItems: { where: { isSection: false } } },
  });

  const budget = await prisma.budget.findFirst({
    where: { projectId },
    orderBy: { budgetDate: 'desc' },
    include: { lineItems: true },
  });

  const approvedCors = await prisma.changeOrder.findMany({
    where: { projectId, status: 'Approved' },
    select: { csiCode: true, totalAmount: true },
  });

  const normDigits = (s: string | null | undefined) => (s || '').replace(/[^0-9]/g, '');
  const divKey = (s: string | null | undefined) => {
    const d = normDigits(s);
    return d.length >= 2 ? d.slice(0, 2) : 'GEN';
  };

  interface DivAgg { code: string; revised: number; executed: number; fromPa: boolean }
  const map = new Map<string, DivAgg>();

  const ensure = (code: string): DivAgg => {
    if (!map.has(code)) map.set(code, { code, revised: 0, executed: 0, fromPa: false });
    return map.get(code)!;
  };

  // 1) Divisions desde el PA (fuente primaria cuando existe)
  if (latestPa) {
    for (const li of latestPa.lineItems) {
      const agg = ensure(divKey(li.sectionCode));
      agg.fromPa = true;
      agg.revised +=
        (li.scheduledValue || 0) + (li.budgetRealloc || 0) +
        (li.previousChanges || 0) + (li.currentChanges || 0);
      agg.executed += (li.previousCompleted || 0) + (li.thisCompleted || 0);
    }
  }

  // 2) Divisiones del Budget que no estan en el PA
  if (budget) {
    for (const li of budget.lineItems) {
      if (li.isSection || li.isSubtotal) continue;
      const agg = ensure(divKey(li.divisionCode));
      if (!agg.fromPa) agg.revised += li.scheduledValue || 0;
    }
  }

  // 3) CORs aprobadas: solo a divisiones que NO vienen del PA (alli ya estan incluidas)
  for (const cor of approvedCors) {
    const key = divKey(cor.csiCode);
    const agg = ensure(key);
    if (!agg.fromPa) agg.revised += cor.totalAmount || 0;
  }

  const divisions = [...map.values()]
    .filter((d) => d.revised > 0 || d.executed > 0)
    .map((d) => ({
      code: d.code,
      revised: d.revised,
      executed: d.executed,
      remaining: Math.max(0, d.revised - d.executed),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const totals = divisions.reduce(
    (acc, d) => ({
      revised: acc.revised + d.revised,
      executed: acc.executed + d.executed,
      remaining: acc.remaining + d.remaining,
    }),
    { revised: 0, executed: 0, remaining: 0 }
  );

  return NextResponse.json({
    divisions,
    totals,
    latestPaNumber: latestPa?.applicationNumber ?? null,
    hasData: divisions.length > 0,
  });
}
