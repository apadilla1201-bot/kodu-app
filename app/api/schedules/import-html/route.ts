export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

interface RawActivity {
  G?: string;
  id?: string;
  nm?: string;
  bs?: string;
  bf?: string;
  od?: number;
  rd?: number;
  pc?: number;
  st?: string;
  cp?: number;
  nt?: string;
}

function parseActivities(raw: RawActivity[]) {
  const activities: any[] = [];
  let sortOrder = 0;

  for (const item of raw) {
    if (item.G) {
      // Group/section header
      const typeMap: Record<string, string> = {
        main: 'group_main',
        sub: 'group_sub',
        warn: 'group_warn',
        crit: 'group_crit',
      };
      activities.push({
        sortOrder: sortOrder++,
        activityId: '',
        activityName: item.nm || '',
        activityType: typeMap[item.G] || 'group_sub',
        originalDuration: 0,
        remainingDuration: 0,
        percentComplete: 0,
        startDate: null,
        finishDate: null,
        status: 'pend',
        isCritical: item.G === 'crit',
        isMilestone: false,
        notes: null,
        wbsCode: '',
        resourceName: '',
        costLoaded: 0,
        floatDays: 0,
      });
    } else if (item.id) {
      // Activity/task
      const isMilestone = (item.od ?? 0) === 0;
      const isCritical = (item.cp ?? 0) === 1;

      // Extract resource/vendor from name pattern "Activity — Vendor ($amount)"
      let resourceName = '';
      const vendorMatch = item.nm?.match(/—\s*([^($]+)/);
      if (vendorMatch) resourceName = vendorMatch[1].trim();

      // Extract cost from name pattern "($123,456)"
      let costLoaded = 0;
      const costMatch = item.nm?.match(/\$([\d,]+(?:\.\d+)?)/);
      if (costMatch) costLoaded = parseFloat(costMatch[1].replace(/,/g, ''));

      activities.push({
        sortOrder: sortOrder++,
        activityId: item.id,
        activityName: item.nm || '',
        activityType: isMilestone ? 'milestone' : 'task',
        originalDuration: item.od ?? 0,
        remainingDuration: item.rd ?? 0,
        percentComplete: item.pc ?? 0,
        startDate: item.bs ? new Date(item.bs + 'T12:00:00') : null,
        finishDate: item.bf ? new Date(item.bf + 'T12:00:00') : null,
        actualStart: item.st === 'done' && item.bs ? new Date(item.bs + 'T12:00:00') : null,
        actualFinish: item.st === 'done' && item.bf ? new Date(item.bf + 'T12:00:00') : null,
        status: item.st || 'pend',
        isCritical,
        isMilestone,
        notes: item.nt || null,
        wbsCode: item.id?.split('-')[0] || '',
        resourceName,
        costLoaded,
        floatDays: 0,
      });
    }
  }

  return activities;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id ?? '';
    // FIX: resolve tenant (companyId) with DB fallback — userId lookup failed for company projects.
    let companyId = (session.user as any)?.companyId ?? '';
    if (!companyId && userId) {
      const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      companyId = dbUser?.companyId ?? '';
    }

    const body = await request.json();
    const { projectId, revision, dataDate, rawActivities } = body;

    if (!projectId || !rawActivities) {
      return NextResponse.json({ error: 'projectId and rawActivities required' }, { status: 400 });
    }

    // Verify project ownership (tenant)
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const activities = parseActivities(rawActivities);

    // Compute project dates
    const taskActs = activities.filter((a: any) => a.startDate && (a.activityType === 'task' || a.activityType === 'milestone'));
    const starts = taskActs.map((a: any) => a.startDate.getTime()).filter((t: number) => !isNaN(t));
    const finishes = taskActs.map((a: any) => (a.finishDate || a.startDate).getTime()).filter((t: number) => !isNaN(t));

    // Mark previous active schedules as Superseded
    await prisma.schedule.updateMany({
      where: { projectId, status: 'Active' },
      data: { status: 'Superseded' },
    });

    const schedule = await prisma.schedule.create({
      data: {
        projectId,
        revision: revision || 'Rev.1',
        dataDate: dataDate ? new Date(dataDate) : new Date(),
        projectStart: starts.length > 0 ? new Date(Math.min(...starts)) : null,
        projectFinish: finishes.length > 0 ? new Date(Math.max(...finishes)) : null,
        status: 'Active',
        activities: {
          create: activities,
        },
      },
      include: {
        _count: { select: { activities: true } },
      },
    });

    return NextResponse.json({
      id: schedule.id,
      revision: schedule.revision,
      activityCount: schedule._count.activities,
      projectStart: schedule.projectStart,
      projectFinish: schedule.projectFinish,
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/schedules/import-html error:', error);
    return NextResponse.json({ error: 'Failed to import schedule' }, { status: 500 });
  }
}
