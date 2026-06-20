export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET /api/schedules/[id]/lookahead — Get 2-week look-ahead activities
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Auth' }, { status: 401 });

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        activities: { orderBy: { sortOrder: 'asc' } },
        project: { select: { userId: true, projectName: true, projectNumber: true } },
      },
    });

    if (!schedule || schedule.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Accept optional startDate query param for custom window start
    const url = new URL(request.url);
    const startDateParam = url.searchParams.get('startDate');
    const dd = startDateParam ? new Date(startDateParam) : new Date(schedule.dataDate);
    if (isNaN(dd.getTime())) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
    const twoWeeksLater = new Date(dd.getTime() + 14 * 86400000);

    // Get CPM activities in the 2-week window (always reflect latest dates from Gantt)
    const cpmInWindow = schedule.activities.filter(a => {
      if (a.isLookAhead) return false;
      if (a.activityType.startsWith('group_')) return false;
      if (a.status === 'done') return false;
      if (!a.startDate) return false;
      const start = new Date(a.startDate);
      const end = a.finishDate ? new Date(a.finishDate) : start;
      return start <= twoWeeksLater && end >= dd;
    });

    // Also get look-ahead detail activities
    const lookAheadDetails = schedule.activities.filter(a => a.isLookAhead);

    // Merge CPM + look-ahead, deduplicate
    const seen = new Set<string>();
    const lookaheadActivities = [...cpmInWindow, ...lookAheadDetails].filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        revision: schedule.revision,
        dataDate: schedule.dataDate,
        projectName: schedule.project.projectName,
        projectNumber: schedule.project.projectNumber,
      },
      windowStart: dd.toISOString(),
      windowEnd: twoWeeksLater.toISOString(),
      activities: lookaheadActivities.map(a => ({
        id: a.id,
        activityId: a.activityId,
        activityName: a.activityName,
        originalDuration: a.originalDuration,
        remainingDuration: a.remainingDuration,
        percentComplete: a.percentComplete,
        startDate: a.startDate?.toISOString() || null,
        finishDate: a.finishDate?.toISOString() || null,
        status: a.status,
        isCritical: a.isCritical,
        isMilestone: a.isMilestone,
        notes: a.notes,
        resourceName: a.resourceName,
        costLoaded: a.costLoaded,
      })),
      detailActivities: lookAheadDetails.map(a => ({
        id: a.id,
        activityId: a.activityId,
        activityName: a.activityName,
        originalDuration: a.originalDuration,
        remainingDuration: a.remainingDuration,
        percentComplete: a.percentComplete,
        startDate: a.startDate?.toISOString() || null,
        finishDate: a.finishDate?.toISOString() || null,
        status: a.status,
        isCritical: a.isCritical,
        notes: a.notes,
        resourceName: a.resourceName,
        parentActivityId: a.parentActivityId,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/schedules/[id]/lookahead error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/schedules/[id]/lookahead — Import look-ahead detail activities
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Auth' }, { status: 401 });

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: { project: { select: { userId: true } } },
    });

    if (!schedule || schedule.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { activities } = await request.json();
    if (!activities || !Array.isArray(activities)) {
      return NextResponse.json({ error: 'activities array required' }, { status: 400 });
    }

    // Delete existing look-ahead activities for this schedule
    await prisma.scheduleActivity.deleteMany({
      where: { scheduleId: params.id, isLookAhead: true },
    });

    // Get max sortOrder
    const maxSort = await prisma.scheduleActivity.aggregate({
      where: { scheduleId: params.id },
      _max: { sortOrder: true },
    });
    let nextSort = (maxSort._max.sortOrder ?? 0) + 100;

    // Create new look-ahead activities
    const created = await prisma.$transaction(
      activities.map((a: any) => {
        const sort = nextSort++;
        return prisma.scheduleActivity.create({
          data: {
            scheduleId: params.id,
            sortOrder: sort,
            activityId: a.activityId || `LA-${sort}`,
            activityName: a.activityName || '',
            activityType: 'task',
            originalDuration: a.originalDuration ?? 0,
            remainingDuration: a.remainingDuration ?? 0,
            percentComplete: a.percentComplete ?? 0,
            startDate: a.startDate ? new Date(a.startDate) : null,
            finishDate: a.finishDate ? new Date(a.finishDate) : null,
            status: a.status || 'pend',
            isCritical: a.isCritical ?? false,
            isMilestone: false,
            notes: a.notes || null,
            resourceName: a.resourceName || '',
            isLookAhead: true,
            parentActivityId: a.parentActivityId || null,
          },
        });
      })
    );

    return NextResponse.json({ imported: created.length }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/schedules/[id]/lookahead error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
