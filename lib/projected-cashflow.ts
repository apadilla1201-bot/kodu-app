import { prisma } from '@/lib/prisma';

/**
 * Cálculo compartido del cash flow proyectado al fin de la obra.
 * Usado por /api/analytics/projected-cashflow y por el PDF ejecutivo para owner.
 *
 * Base real POR DIVISION:
 * - Divisions presentes en el ultimo PA: revised/executed desde el PA (sus columnas
 *   de change orders ya llevan las CORs aprobadas — misma regla anti doble carga del Buy Out)
 * - Divisiones sin PA: scheduled del Budget + CORs aprobadas (match CSI 2 digitos)
 * - CORs pendientes/rechazadas nunca se incluyen
 */
export interface ProjectedCashflowResult {
  divisions: { code: string; revised: number; executed: number; remaining: number }[];
  totals: { revised: number; executed: number; remaining: number };
  latestPaNumber: number | null;
  hasData: boolean;
  cpm: any;
  project: { projectName: string; projectNumber: string; client: string | null; location: string | null } | null;
}

export async function computeProjectedCashflow(
  projectId: string,
  companyId: string
): Promise<ProjectedCashflowResult> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { projectName: true, projectNumber: true, client: true, location: true },
  });
  if (!project) {
    throw new Error('Project not found');
  }

  // Self-heal: dataDate corrupta de imports viejos ('9-30' parseaba como 2001)
  const badDate = await prisma.schedule.findFirst({
    where: { projectId, dataDate: { lt: new Date('2020-01-01') } },
    select: { id: true, updatedAt: true },
  });
  if (badDate) {
    await prisma.schedule.update({ where: { id: badDate.id }, data: { dataDate: badDate.updatedAt } });
  }

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

  // ── CPM: esparcir costos remanentes de las actividades por mes (ventana restante) ──
  const schedule = await prisma.schedule.findFirst({
    where: { projectId, status: 'Active' },
    orderBy: { updatedAt: 'desc' },
    include: { activities: true },
  });

  let cpm: any = null;
  if (schedule) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const costed = schedule.activities.filter((a) => (a.costLoaded || 0) > 0 && a.finishDate);
    let remainingCost = costed.reduce(
      (s, a) => s + (a.costLoaded || 0) * (1 - (a.percentComplete || 0) / 100),
      0
    );

    // Fallback: si el CPM no trae costos cargados en las actividades, distribuir el
    // faltante REAL del proyecto (totals.remaining) de forma equitativa entre las
    // tareas pendientes, y esparcirlo por meses segun su duracion restante.
    let fallbackDistributed = false;
    let activeCosted = costed;
    if (remainingCost < 1000 && totals.remaining > 1000) {
      const pendingTasks = schedule.activities.filter(
        (a) =>
          a.activityType === 'task' &&
          !a.isLookAhead &&
          !a.isMilestone &&
          a.finishDate &&
          a.finishDate > today &&
          (a.percentComplete || 0) < 100
      );
      if (pendingTasks.length > 0) {
        const perTask = totals.remaining / pendingTasks.length;
        activeCosted = pendingTasks.map((a) => ({ ...a, costLoaded: perTask, percentComplete: 0 }));
        remainingCost = totals.remaining;
        fallbackDistributed = true;
      }
    }

    const finish =
      schedule.projectFinish ??
      (activeCosted.length > 0
        ? activeCosted.reduce((max, a) => (a.finishDate! > max ? a.finishDate! : max), today)
        : today);

    const monthMap = new Map<string, number>();
    for (const a of activeCosted) {
      const ws = a.startDate && a.startDate > today ? a.startDate : today;
      const we = a.finishDate!;
      if (we <= today) continue;
      const rem = (a.costLoaded || 0) * (1 - (a.percentComplete || 0) / 100);
      const totalDays = Math.max(1, Math.round((we.getTime() - ws.getTime()) / 86400000));
      let cur = new Date(ws.getFullYear(), ws.getMonth(), 1);
      const endM = new Date(we.getFullYear(), we.getMonth(), 1);
      let guard = 0;
      while (cur <= endM && guard < 240) {
        const mStart = cur > ws ? cur : ws;
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const mEnd = next < we ? new Date(next.getTime() - 1) : we;
        const days = Math.max(0, Math.round((mEnd.getTime() - mStart.getTime()) / 86400000));
        if (days > 0) {
          const key = `${cur.getFullYear()}-${cur.getMonth()}`;
          monthMap.set(key, (monthMap.get(key) || 0) + (rem * days) / totalDays);
        }
        cur = next;
        guard++;
      }
    }

    const months = [...monthMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, amount]) => {
        const [y, m] = key.split('-').map(Number);
        return {
          key,
          label: new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          amount,
        };
      });

    cpm = {
      available: true,
      revision: schedule.revision,
      finishDate: finish,
      dataDate: schedule.dataDate,
      months,
      remainingCost,
      costedActivities: activeCosted.length,
      totalActivities: schedule.activities.length,
      fallbackDistributed,
      distributedAmount: fallbackDistributed ? totals.remaining : remainingCost,
    };
  }

  return {
    divisions,
    totals,
    latestPaNumber: latestPa?.applicationNumber ?? null,
    hasData: divisions.length > 0,
    cpm,
    project,
  };
}
