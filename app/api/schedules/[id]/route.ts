export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { projectName: true, projectNumber: true, userId: true, id: true } },
        activities: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!schedule || schedule.project.userId !== (session.user as any).id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(schedule);
  } catch (error: any) {
    console.error('GET /api/schedules/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: { project: { select: { userId: true } } },
    });
    if (!schedule || schedule.project.userId !== (session.user as any).id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();

    // If updating activities
    if (body.activities) {
      // Delete existing and recreate
      await prisma.scheduleActivity.deleteMany({ where: { scheduleId: params.id } });
      await prisma.scheduleActivity.createMany({
        data: body.activities.map((a: any, idx: number) => ({
          scheduleId: params.id,
          sortOrder: a.sortOrder ?? idx,
          activityId: a.activityId || '',
          activityName: a.activityName || '',
          activityType: a.activityType || 'task',
          originalDuration: a.originalDuration ?? 0,
          remainingDuration: a.remainingDuration ?? 0,
          percentComplete: a.percentComplete ?? 0,
          startDate: a.startDate ? new Date(a.startDate) : null,
          finishDate: a.finishDate ? new Date(a.finishDate) : null,
          actualStart: a.actualStart ? new Date(a.actualStart) : null,
          actualFinish: a.actualFinish ? new Date(a.actualFinish) : null,
          status: a.status || 'pend',
          isCritical: a.isCritical ?? false,
          isMilestone: a.isMilestone ?? false,
          notes: a.notes || null,
          wbsCode: a.wbsCode || '',
          predecessors: a.predecessors || null,
          successors: a.successors || null,
          floatDays: a.floatDays ?? 0,
          costLoaded: a.costLoaded ?? 0,
          resourceName: a.resourceName || '',
        })),
      });
    }

    // Update schedule-level fields
    const updateData: any = {};
    if (body.revision !== undefined) updateData.revision = body.revision;
    if (body.dataDate !== undefined) updateData.dataDate = new Date(body.dataDate);
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    const updated = await prisma.schedule.update({
      where: { id: params.id },
      data: updateData,
      include: { activities: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/schedules/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

// Update a single activity
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: { project: { select: { userId: true } } },
    });
    if (!schedule || schedule.project.userId !== (session.user as any).id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { activityDbId, ...fields } = body;

    if (!activityDbId) return NextResponse.json({ error: 'activityDbId required' }, { status: 400 });

    const updateData: any = {};
    if (fields.percentComplete !== undefined) updateData.percentComplete = fields.percentComplete;
    if (fields.startDate !== undefined) updateData.startDate = fields.startDate ? new Date(fields.startDate) : null;
    if (fields.finishDate !== undefined) updateData.finishDate = fields.finishDate ? new Date(fields.finishDate) : null;
    if (fields.status !== undefined) updateData.status = fields.status;
    if (fields.remainingDuration !== undefined) updateData.remainingDuration = fields.remainingDuration;
    if (fields.originalDuration !== undefined) updateData.originalDuration = fields.originalDuration;
    if (fields.activityName !== undefined) updateData.activityName = fields.activityName;
    if (fields.notes !== undefined) updateData.notes = fields.notes;
    if (fields.isCritical !== undefined) updateData.isCritical = fields.isCritical;
    if (fields.resourceName !== undefined) updateData.resourceName = fields.resourceName;

    // Auto-calc remaining duration based on % and original
    if (fields.percentComplete !== undefined && fields.originalDuration !== undefined) {
      updateData.remainingDuration = Math.round(fields.originalDuration * (1 - fields.percentComplete / 100));
    }

    const activity = await prisma.scheduleActivity.update({
      where: { id: activityDbId },
      data: updateData,
    });

    // Update schedule dataDate
    await prisma.schedule.update({
      where: { id: params.id },
      data: { dataDate: new Date() },
    });

    return NextResponse.json(activity);
  } catch (error: any) {
    console.error('PUT /api/schedules/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}
