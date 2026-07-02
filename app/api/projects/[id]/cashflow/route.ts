export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * Owner Cashflow Projection API
 * Generates monthly cashflow projections for the owner based on:
 * - Schedule cost-loaded activities (planned spend)
 * - Pay Applications (actual billed/certified)
 * - Change Orders (approved adjustments)
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId },
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
          include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { applicationNumber: 'asc' },
        },
        changeOrders: {
          where: { status: 'Approved' },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const activeSchedule = project.schedules[0];
    const activities = activeSchedule
      ? activeSchedule.activities.filter(
          (a) => (a.activityType === 'task' || a.activityType === 'milestone') && a.costLoaded > 0
        )
      : [];

    // --- Determine time range ---
    const allDates = activities
      .flatMap((a) => [a.startDate, a.finishDate])
      .filter(Boolean) as Date[];
    
    const payAppDates = project.payApplications.map((pa) => pa.periodTo);
    allDates.push(...payAppDates);
    
    if (allDates.length === 0) {
      return NextResponse.json({
        monthly: [],
        summary: null,
        message: 'No schedule or pay app data available',
      });
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    // --- Generate monthly buckets ---
    const months: { key: string; start: Date; end: Date }[] = [];
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      months.push({
        key: cur.toISOString().slice(0, 7), // YYYY-MM
        start: new Date(cur),
        end,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    // Add 2 months beyond for projection
    for (let i = 0; i < 2; i++) {
      const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      months.push({
        key: cur.toISOString().slice(0, 7),
        start: new Date(cur),
        end,
      });
      cur.setMonth(cur.getMonth() + 1);
    }

    // --- Planned monthly spend from schedule ---
    const plannedMonthly = new Map<string, number>();
    for (const act of activities) {
      if (!act.startDate || !act.finishDate) continue;
      const start = act.startDate.getTime();
      const finish = act.finishDate.getTime();
      const totalDuration = Math.max(finish - start, 1000 * 60 * 60 * 24);
      const dailyRate = act.costLoaded / (totalDuration / (1000 * 60 * 60 * 24));

      for (const month of months) {
        const mStart = Math.max(month.start.getTime(), start);
        const mEnd = Math.min(month.end.getTime(), finish);
        if (mStart > mEnd) continue;
        const days = (mEnd - mStart) / (1000 * 60 * 60 * 24);
        const amount = dailyRate * days;
        plannedMonthly.set(month.key, (plannedMonthly.get(month.key) || 0) + amount);
      }
    }

    // --- Actual billed from Pay Applications ---
    const billedMonthly = new Map<string, number>();
    for (const pa of project.payApplications) {
      const monthKey = pa.periodTo.toISOString().slice(0, 7);
      const regularItems = pa.lineItems.filter((li) => !li.isSection);
      const thisAmount = regularItems.reduce((s, li) => s + (li.thisCompleted || 0), 0);
      billedMonthly.set(monthKey, (billedMonthly.get(monthKey) || 0) + thisAmount);
    }

    // --- Approved COs ---
    const totalApprovedCOs = project.changeOrders.reduce((s, co) => s + co.totalAmount, 0);
    const originalContract = project.contractAmount || 0;
    const adjustedContract = originalContract + totalApprovedCOs;

    // --- Build monthly series ---
    let cumPlanned = 0;
    let cumBilled = 0;
    const monthly = months.map((month) => {
      const planned = plannedMonthly.get(month.key) || 0;
      const billed = billedMonthly.get(month.key) || 0;
      cumPlanned += planned;
      cumBilled += billed;
      return {
        month: month.key,
        planned: Math.round(planned),
        billed: Math.round(billed),
        cumPlanned: Math.round(cumPlanned),
        cumBilled: Math.round(cumBilled),
      };
    });

    // --- Summary ---
    const totalPlanned = activities.reduce((s, a) => s + (a.costLoaded || 0), 0);
    const totalBilled = Array.from(billedMonthly.values()).reduce((s, v) => s + v, 0);
    const retainage = project.payApplications.length > 0
      ? project.payApplications[project.payApplications.length - 1].retainagePercent || 0.10
      : 0.10;

    return NextResponse.json({
      monthly,
      summary: {
        originalContract: Math.round(originalContract),
        approvedCOs: Math.round(totalApprovedCOs),
        adjustedContract: Math.round(adjustedContract),
        totalPlanned: Math.round(totalPlanned),
        totalBilled: Math.round(totalBilled),
        remainingToBill: Math.round(adjustedContract - totalBilled),
        retainageRate: retainage,
        retainageHeld: Math.round(totalBilled * retainage),
      },
    });
  } catch (error: any) {
    console.error('GET /api/projects/[id]/cashflow error:', error);
    return NextResponse.json({ error: 'Failed to compute cashflow' }, { status: 500 });
  }
}
