export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { randomBytes } from 'crypto';

const VALID_PRIORITY = ['A', 'B', 'C'];
const VALID_STATUS = ['Open', 'In Progress', 'Ready for Review', 'Completed', 'Disputed'];

// Regla PDG (Excel Arena Madness): A = 5 días hábiles, B/C = 10 días hábiles
function addWorkdays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role) && role !== 'superintendent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const where: any = { project: { companyId } };
    if (projectId) where.projectId = projectId;

    const items = await prisma.punchItem.findMany({
      where,
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
      },
      orderBy: [{ projectId: 'asc' }, { itemNumber: 'asc' }],
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error('GET /api/punch-items error:', error);
    if (String(error?.message ?? '').includes('PunchItem')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to fetch punch items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role) && role !== 'superintendent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      projectId, title, description, location, trade, area, correctiveAction,
      identifiedBy, assignedToName, assignedToEmail, priority, dueDate, notes,
      planSheetId, pinX, pinY,
    } = body ?? {};

    if (!projectId || !title?.trim()) {
      return NextResponse.json({ error: 'Project and title are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const last = await prisma.punchItem.findFirst({
      where: { projectId },
      orderBy: { itemNumber: 'desc' },
    });
    const itemNumber = (last?.itemNumber ?? 0) + 1;

    // Vencimiento automático por prioridad si no se indicó fecha (regla PDG)
    const prio = VALID_PRIORITY.includes(priority) ? priority : 'B';
    const autoDue = dueDate ? new Date(dueDate) : addWorkdays(new Date(), prio === 'A' ? 5 : 10);

    const item = await prisma.punchItem.create({
      data: {
        projectId,
        itemNumber,
        title: String(title).trim(),
        description: description ? String(description) : null,
        location: location ? String(location) : null,
        trade: trade ? String(trade) : null,
        area: area ? String(area) : null,
        correctiveAction: correctiveAction ? String(correctiveAction) : null,
        identifiedBy: identifiedBy ? String(identifiedBy) : ((session.user as any)?.name ?? null),
        assignedToName: assignedToName ? String(assignedToName) : null,
        assignedToEmail: assignedToEmail ? String(assignedToEmail).trim().toLowerCase() : null,
        priority: prio,
        dueDate: autoDue,
        notes: notes ? String(notes) : null,
        planSheetId: planSheetId ? String(planSheetId) : null,
        pinX: typeof pinX === 'number' ? pinX : null,
        pinY: typeof pinY === 'number' ? pinY : null,
        externalToken: randomBytes(24).toString('hex'),
        createdByName: (session.user as any)?.name ?? null,
        createdByEmail: (session.user as any)?.email ?? null,
      },
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/punch-items error:', error);
    if (String(error?.message ?? '').includes('PunchItem')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create punch item' }, { status: 500 });
  }
}
