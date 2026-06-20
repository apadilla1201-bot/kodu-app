export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// POST /api/schedules/[id]/clone — Clone a schedule as a new revision
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Auth' }, { status: 401 });

    const body = await request.json();
    const { revision, dataDate, notes } = body;

    const source = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        activities: { orderBy: { sortOrder: 'asc' } },
        project: { select: { userId: true, projectName: true } },
      },
    });

    if (!source || source.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Supersede all active schedules for this project
    await prisma.schedule.updateMany({
      where: { projectId: source.projectId, status: 'Active' },
      data: { status: 'Superseded' },
    });

    // Clone with new revision
    const newSchedule = await prisma.schedule.create({
      data: {
        projectId: source.projectId,
        revision: revision || `Rev.${Date.now()}`,
        dataDate: dataDate ? new Date(dataDate) : new Date(),
        projectStart: source.projectStart,
        projectFinish: source.projectFinish,
        tcoDate: source.tcoDate,
        notes: notes || source.notes,
        status: 'Active',
        activities: {
          create: source.activities
            .filter(a => !a.isLookAhead) // Don't clone look-ahead items
            .map((a, idx) => ({
              sortOrder: a.sortOrder,
              activityId: a.activityId,
              activityName: a.activityName,
              activityType: a.activityType,
              originalDuration: a.originalDuration,
              remainingDuration: a.remainingDuration,
              percentComplete: a.percentComplete,
              startDate: a.startDate,
              finishDate: a.finishDate,
              actualStart: a.actualStart,
              actualFinish: a.actualFinish,
              status: a.status,
              isCritical: a.isCritical,
              isMilestone: a.isMilestone,
              notes: a.notes,
              wbsCode: a.wbsCode,
              predecessors: a.predecessors,
              successors: a.successors,
              floatDays: a.floatDays,
              costLoaded: a.costLoaded,
              resourceName: a.resourceName,
            })),
        },
      },
      include: { activities: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json(newSchedule, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/schedules/[id]/clone error:', error);
    return NextResponse.json({ error: 'Failed to clone' }, { status: 500 });
  }
}
