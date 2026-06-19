export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * Earned Value Analysis API
 * Computes BCWS (Planned Value), BCWP (Earned Value), and ACWP (Actual Cost)
 * from CPM schedule cost-loaded activities and Pay Application data.
 *
 * BCWS = cumulative planned cost based on schedule baseline dates
 * BCWP = cumulative earned value based on % complete × costLoaded
 * ACWP = cumulative actual cost from Pay Application certified amounts
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id ?? '';

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        schedules: {
          where: { status: 'Active' },
          include: {
            activities: {
              where: { isLookAhead: false },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        payApplications: {
          include: {
            lineItems: { orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { applicationNumber: 'asc' },
        },
      },
    });

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const activeSchedule = project.schedules[0];
    if (!activeSchedule) {
      return NextResponse.json({
        series: [],
        kpis: null,
        message: 'No active schedule found',
      });
    }

    const activities = activeSchedule.activities.filter(
      (a) => a.activityType === 'task' || a.activityType === 'milestone'
    );

    // --- Determine time range ---
    const allDates = activities
      .flatMap((a) => [a.startDate, a.finishDate])
      .filter(Boolean) as Date[];
    if (allDates.length === 0) {
      return NextResponse.json({ series: [], kpis: null, message: 'No activities with dates' });
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    const dataDate = activeSchedule.dataDate;

    // Total budget (BAC)
    const bac = activities.reduce((s, a) => s + (a.costLoaded || 0), 0);

    // --- Generate weekly time buckets ---
    const buckets: Date[] = [];
    const cur = new Date(minDate);
    cur.setDate(cur.getDate() - (cur.getDay())); // start on Sunday
    while (cur <= maxDate || cur <= dataDate) {
      buckets.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
    // Add a couple extra weeks beyond
    for (let i = 0; i < 4; i++) {
      buckets.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }

    // --- BCWS (Planned Value) ---
    // Distribute each activity's costLoaded linearly over its duration
    const bcwsMap = new Map<number, number>();
    for (const act of activities) {
      if (!act.startDate || !act.finishDate || !act.costLoaded) continue;
      const start = act.startDate.getTime();
      const finish = act.finishDate.getTime();
      const duration = Math.max(finish - start, 1);
      const dailyRate = act.costLoaded / (duration / (1000 * 60 * 60 * 24));

      for (const bucket of buckets) {
        const bTime = bucket.getTime();
        if (bTime < start) continue;
        const elapsed = Math.min(bTime - start, finish - start);
        const elapsedDays = elapsed / (1000 * 60 * 60 * 24);
        const earned = Math.min(dailyRate * elapsedDays, act.costLoaded);
        bcwsMap.set(bTime, (bcwsMap.get(bTime) || 0) + earned);
      }
    }

    // --- BCWP (Earned Value) ---
    // At each bucket, sum (percentComplete × costLoaded) for activities
    // that have started by that date
    const bcwpMap = new Map<number, number>();
    for (const bucket of buckets) {
      const bTime = bucket.getTime();
      let ev = 0;
      for (const act of activities) {
        if (!act.startDate || !act.costLoaded) continue;
        if (act.startDate.getTime() > bTime) continue;
        // For buckets before data date, interpolate progress linearly
        // For buckets at/after data date, use actual % complete
        if (bTime <= dataDate.getTime()) {
          if (!act.finishDate) continue;
          const start = act.startDate.getTime();
          const finish = act.finishDate.getTime();
          const elapsed = Math.min(bTime - start, finish - start);
          const pctTime = elapsed / Math.max(finish - start, 1);
          const effectivePct = Math.min(pctTime * (act.percentComplete / 100), act.percentComplete / 100);
          ev += effectivePct * act.costLoaded;
        } else {
          // After data date, freeze at current % complete
          ev += (act.percentComplete / 100) * act.costLoaded;
        }
      }
      bcwpMap.set(bTime, ev);
    }

    // --- ACWP (Actual Cost) from Pay Applications ---
    const payApps = project.payApplications;
    const acwpByDate = new Map<number, number>();
    let cumulativeActual = 0;
    for (const pa of payApps) {
      const regularItems = pa.lineItems.filter((li) => !li.isSection && !li.isFee && !li.isBelowLine);
      const thisAmount = regularItems.reduce((s, li) => s + (li.thisCompleted || 0), 0);
      cumulativeActual += thisAmount;
      acwpByDate.set(pa.periodTo.getTime(), cumulativeActual);
    }

    // Interpolate ACWP into weekly buckets
    const acwpEntries = Array.from(acwpByDate.entries()).sort((a, b) => a[0] - b[0]);

    // --- Build series ---
    const series = buckets.map((bucket) => {
      const bTime = bucket.getTime();
      const bcws = bcwsMap.get(bTime) || 0;
      const bcwp = bcwpMap.get(bTime) || 0;

      // Find ACWP: use last known value at or before this bucket
      let acwp = 0;
      for (const [t, v] of acwpEntries) {
        if (t <= bTime) acwp = v;
        else break;
      }

      return {
        date: bucket.toISOString().split('T')[0],
        bcws: Math.round(bcws),
        bcwp: Math.round(bcwp),
        acwp: Math.round(acwp),
      };
    });

    // --- KPIs at data date ---
    const currentBCWS = bcwsMap.get(
      buckets.reduce((closest, b) => {
        return Math.abs(b.getTime() - dataDate.getTime()) <
          Math.abs(closest.getTime() - dataDate.getTime())
          ? b
          : closest;
      }).getTime()
    ) || 0;
    const currentBCWP = activities.reduce(
      (s, a) => s + (a.percentComplete / 100) * (a.costLoaded || 0),
      0
    );
    const currentACWP = acwpEntries.length > 0 ? acwpEntries[acwpEntries.length - 1][1] : 0;

    const spi = currentBCWS > 0 ? currentBCWP / currentBCWS : 1;
    const cpi = currentACWP > 0 ? currentBCWP / currentACWP : 1;
    const sv = currentBCWP - currentBCWS;
    const cv = currentBCWP - currentACWP;
    const eac = cpi > 0 ? bac / cpi : bac;
    const etc = eac - currentACWP;
    const vac = bac - eac;
    const overallPct = bac > 0 ? (currentBCWP / bac) * 100 : 0;

    return NextResponse.json({
      series,
      kpis: {
        bac: Math.round(bac),
        bcws: Math.round(currentBCWS),
        bcwp: Math.round(currentBCWP),
        acwp: Math.round(currentACWP),
        spi: parseFloat(spi.toFixed(2)),
        cpi: parseFloat(cpi.toFixed(2)),
        sv: Math.round(sv),
        cv: Math.round(cv),
        eac: Math.round(eac),
        etc: Math.round(etc),
        vac: Math.round(vac),
        overallPct: parseFloat(overallPct.toFixed(1)),
        dataDate: dataDate.toISOString().split('T')[0],
      },
    });
  } catch (error: any) {
    console.error('GET /api/projects/[id]/earned-value error:', error);
    return NextResponse.json({ error: 'Failed to compute earned value' }, { status: 500 });
  }
}
