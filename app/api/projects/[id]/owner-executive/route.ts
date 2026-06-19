export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * Owner Executive Cashflow API
 * Returns:
 * 1. Real out-of-pocket from PA#1 onward (cumulative actual disbursements)
 * 2. Original CPM baseline projection (earliest schedule revision)
 * 3. Current CPM projection (active schedule, if different from original)
 * 4. Acceleration scenario data (compressed remaining work into target date)
 *
 * CRITICAL: Timeline starts from first PA date, NOT from CPM start.
 */

interface MonthBucket {
  key: string; // YYYY-MM
  start: Date;
  end: Date;
}

function generateMonthBuckets(from: Date, to: Date, extraMonths = 3): MonthBucket[] {
  const months: MonthBucket[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const endTarget = new Date(to);
  endTarget.setMonth(endTarget.getMonth() + extraMonths);
  while (cur <= endTarget) {
    const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    months.push({ key: cur.toISOString().slice(0, 7), start: new Date(cur), end });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function distributeActivitiesToMonths(
  activities: { startDate: Date | null; finishDate: Date | null; costLoaded: number }[],
  months: MonthBucket[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const act of activities) {
    if (!act.startDate || !act.finishDate || !act.costLoaded) continue;
    const start = act.startDate.getTime();
    const finish = act.finishDate.getTime();
    const totalDuration = Math.max(finish - start, 86400000); // at least 1 day
    const dailyRate = act.costLoaded / (totalDuration / 86400000);

    for (const month of months) {
      const mStart = Math.max(month.start.getTime(), start);
      const mEnd = Math.min(month.end.getTime(), finish);
      if (mStart > mEnd) continue;
      const days = (mEnd - mStart) / 86400000;
      const amount = dailyRate * days;
      map.set(month.key, (map.get(month.key) || 0) + amount);
    }
  }
  return map;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id ?? '';

    // Parse optional target acceleration date from query
    const url = new URL(request.url);
    const accelDateStr = url.searchParams.get('accelDate');

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        schedules: {
          include: {
            activities: {
              where: { isLookAhead: false },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' }, // oldest first = original baseline
        },
        payApplications: {
          include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { applicationNumber: 'asc' },
        },
        changeOrders: { where: { status: 'Approved' } },
      },
    });

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const payApps = project.payApplications;
    if (payApps.length === 0) {
      return NextResponse.json({
        series: [],
        summary: null,
        message: 'No Pay Applications found. Create PA#1 to generate the executive cashflow.',
      });
    }

    // --- Identify schedules ---
    const allSchedules = project.schedules;
    const originalSchedule = allSchedules[0] || null; // first imported = baseline
    const activeSchedule = allSchedules.find((s) => s.status === 'Active') || originalSchedule;
    const hasModifiedCPM = activeSchedule && originalSchedule && activeSchedule.id !== originalSchedule.id;

    // --- Timeline: starts from first PA periodFrom ---
    const firstPADate = payApps[0].periodFrom;
    const lastDates: Date[] = payApps.map((pa) => pa.periodTo);
    if (activeSchedule?.activities) {
      activeSchedule.activities.forEach((a) => {
        if (a.finishDate) lastDates.push(a.finishDate);
      });
    }
    if (originalSchedule?.activities && hasModifiedCPM) {
      originalSchedule.activities.forEach((a) => {
        if (a.finishDate) lastDates.push(a.finishDate);
      });
    }
    const maxDate = new Date(Math.max(...lastDates.map((d) => d.getTime())));
    const months = generateMonthBuckets(firstPADate, maxDate, 3);

    // --- 1. Real Out-of-Pocket from Pay Applications ---
    const outOfPocketMonthly = new Map<string, number>();
    for (const pa of payApps) {
      const monthKey = pa.periodTo.toISOString().slice(0, 7);
      // Real out-of-pocket = sum of all thisCompleted across non-section items
      // This represents what the owner actually paid
      const items = pa.lineItems.filter((li) => !li.isSection);
      const thisAmount = items.reduce((s, li) => s + (li.thisCompleted || 0), 0);
      // Add retainage-adjusted amount (owner pays completed minus retainage held)
      const retRate = pa.retainagePercent || 0.10;
      const netPayment = thisAmount * (1 - retRate);
      outOfPocketMonthly.set(monthKey, (outOfPocketMonthly.get(monthKey) || 0) + netPayment);
    }

    // --- 2. Original CPM Projection ---
    const origTasks = originalSchedule
      ? originalSchedule.activities.filter(
          (a) => (a.activityType === 'task' || a.activityType === 'milestone') && a.costLoaded > 0
        )
      : [];
    const originalProjection = distributeActivitiesToMonths(origTasks, months);

    // --- 3. Current CPM Projection (if modified) ---
    let currentProjection: Map<string, number> | null = null;
    if (hasModifiedCPM && activeSchedule) {
      const activeTasks = activeSchedule.activities.filter(
        (a) => (a.activityType === 'task' || a.activityType === 'milestone') && a.costLoaded > 0
      );
      currentProjection = distributeActivitiesToMonths(activeTasks, months);
    }

    // --- 4. Acceleration Scenario ---
    let accelProjection: Map<string, number> | null = null;
    let accelTargetDate: string | null = null;
    if (accelDateStr && activeSchedule) {
      const targetDate = new Date(accelDateStr);
      accelTargetDate = accelDateStr;
      const dataDate = activeSchedule.dataDate;
      const activeTasks = activeSchedule.activities.filter(
        (a) => (a.activityType === 'task' || a.activityType === 'milestone') && a.costLoaded > 0
      );

      // For acceleration: compress remaining incomplete work into the window [dataDate, targetDate]
      const accelActivities = activeTasks.map((a) => {
        if (!a.startDate || !a.finishDate) return a;
        const pctDone = a.percentComplete / 100;
        if (pctDone >= 1) return a; // already complete, keep as-is

        const remainingCost = a.costLoaded * (1 - pctDone);
        // If activity hasn't started yet, compress entirely into acceleration window
        if (a.startDate > dataDate) {
          return {
            ...a,
            startDate: dataDate,
            finishDate: targetDate,
            costLoaded: remainingCost,
          };
        }
        // If in progress, the remaining portion runs from dataDate to targetDate
        return {
          ...a,
          startDate: dataDate,
          finishDate: targetDate,
          costLoaded: remainingCost,
        };
      });

      // Add already-completed portion at their original dates
      const completedPortions = activeTasks
        .filter((a) => a.startDate && a.finishDate && a.percentComplete > 0)
        .map((a) => ({
          startDate: a.startDate,
          finishDate: new Date(Math.min(a.finishDate!.getTime(), dataDate.getTime())),
          costLoaded: a.costLoaded * (a.percentComplete / 100),
        }));

      const accelMonths = generateMonthBuckets(firstPADate, targetDate, 1);
      accelProjection = distributeActivitiesToMonths(
        [...completedPortions, ...accelActivities] as any,
        accelMonths
      );
    }

    // --- Build series ---
    let cumOOP = 0;
    let cumOrig = 0;
    let cumCurrent = 0;
    let cumAccel = 0;

    const series = months.map((month) => {
      const oop = outOfPocketMonthly.get(month.key) || 0;
      const orig = originalProjection.get(month.key) || 0;
      const curr = currentProjection?.get(month.key) ?? null;
      const accel = accelProjection?.get(month.key) ?? null;

      cumOOP += oop;
      cumOrig += orig;
      if (curr !== null) cumCurrent += curr;
      if (accel !== null) cumAccel += accel;

      return {
        month: month.key,
        outOfPocket: Math.round(oop),
        cumOutOfPocket: Math.round(cumOOP),
        origProjection: Math.round(orig),
        cumOrigProjection: Math.round(cumOrig),
        ...(currentProjection ? {
          currentProjection: Math.round(curr || 0),
          cumCurrentProjection: Math.round(cumCurrent),
        } : {}),
        ...(accelProjection ? {
          accelProjection: Math.round(accel || 0),
          cumAccelProjection: Math.round(cumAccel),
        } : {}),
      };
    });

    // --- Summary KPIs ---
    const totalOOP = Array.from(outOfPocketMonthly.values()).reduce((s, v) => s + v, 0);
    const totalBudget = origTasks.reduce((s, a) => s + (a.costLoaded || 0), 0);
    const totalApprovedCOs = project.changeOrders.reduce((s, co) => s + co.totalAmount, 0);
    const contractAmount = project.contractAmount || 0;
    const adjustedContract = contractAmount + totalApprovedCOs;
    const retainageRate = payApps[payApps.length - 1]?.retainagePercent || 0.10;

    // Gross billed (before retainage)
    const grossBilled = payApps.reduce((sum, pa) => {
      const items = pa.lineItems.filter((li) => !li.isSection);
      return sum + items.reduce((s, li) => s + (li.thisCompleted || 0), 0);
    }, 0);
    const retainageHeld = grossBilled * retainageRate;

    // Original completion date
    const origFinish = originalSchedule
      ? originalSchedule.activities
          .filter((a) => a.finishDate)
          .reduce((max, a) => (a.finishDate! > max ? a.finishDate! : max), new Date(0))
      : null;

    // Current completion date
    const currentFinish = activeSchedule && hasModifiedCPM
      ? activeSchedule.activities
          .filter((a) => a.finishDate)
          .reduce((max, a) => (a.finishDate! > max ? a.finishDate! : max), new Date(0))
      : null;

    const remainingBudget = totalBudget - totalOOP;
    const pctDisbursed = totalBudget > 0 ? (totalOOP / totalBudget) * 100 : 0;

    return NextResponse.json({
      series,
      summary: {
        contractAmount: Math.round(contractAmount),
        approvedCOs: Math.round(totalApprovedCOs),
        adjustedContract: Math.round(adjustedContract),
        totalBudgetCPM: Math.round(totalBudget),
        totalOutOfPocket: Math.round(totalOOP),
        grossBilled: Math.round(grossBilled),
        retainageHeld: Math.round(retainageHeld),
        retainageRate,
        remainingBudget: Math.round(remainingBudget),
        pctDisbursed: parseFloat(pctDisbursed.toFixed(1)),
        payAppCount: payApps.length,
        firstPADate: firstPADate.toISOString().split('T')[0],
        origFinishDate: origFinish ? origFinish.toISOString().split('T')[0] : null,
        currentFinishDate: currentFinish ? currentFinish.toISOString().split('T')[0] : null,
        hasModifiedCPM,
        originalRevision: originalSchedule?.revision || null,
        currentRevision: activeSchedule?.revision || null,
        dataDate: activeSchedule?.dataDate?.toISOString().split('T')[0] || null,
        accelTargetDate,
      },
    });
  } catch (error: any) {
    console.error('GET /api/projects/[id]/owner-executive error:', error);
    return NextResponse.json({ error: 'Failed to compute executive cashflow' }, { status: 500 });
  }
}
