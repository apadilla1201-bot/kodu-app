export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = (session?.user as any)?.companyId ?? '';
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const where: any = { project: { companyId } };
    if (projectId) where.projectId = projectId;

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        _count: { select: { activities: true } },
        project: { select: { projectName: true, projectNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(schedules);
  } catch (error: any) {
    console.error('GET /api/schedules error:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { projectId, revision, dataDate, notes, activities } = body;

    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    const companyId = (session?.user as any)?.companyId ?? '';
    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Mark previous active schedules as Superseded
    await prisma.schedule.updateMany({
      where: { projectId, status: 'Active' },
      data: { status: 'Superseded' },
    });

    // Calculate project dates from activities
    const taskActivities = (activities || []).filter((a: any) => a.startDate && a.activityType === 'task');
    const starts = taskActivities.map((a: any) => new Date(a.startDate)).filter((d: Date) => !isNaN(d.getTime()));
    const finishes = taskActivities.map((a: any) => new Date(a.finishDate)).filter((d: Date) => !isNaN(d.getTime()));
    const projectStart = starts.length > 0 ? new Date(Math.min(...starts.map((d: Date) => d.getTime()))) : null;
    const projectFinish = finishes.length > 0 ? new Date(Math.max(...finishes.map((d: Date) => d.getTime()))) : null;

    const schedule = await prisma.schedule.create({
      data: {
        projectId,
        revision: revision || 'Rev.1',
        dataDate: dataDate ? new Date(dataDate) : new Date(),
        projectStart,
        projectFinish,
        notes: notes || null,
        status: 'Active',
        activities: {
          create: (activities || []).map((a: any, idx: number) => ({
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
        },
      },
      include: { activities: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/schedules error:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}
