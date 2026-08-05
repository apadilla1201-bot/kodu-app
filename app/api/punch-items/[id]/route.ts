export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';

const VALID_PRIORITY = ['Low', 'Medium', 'High'];
const VALID_STATUS = ['Open', 'In Progress', 'Ready for Review', 'Completed'];

function guard(role: string): boolean {
  return isFullAccess(role) || role === 'superintendent';
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!guard(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.punchItem.findFirst({
      where: { id: params.id, project: { companyId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.location !== undefined) data.location = body.location ? String(body.location) : null;
    if (body.trade !== undefined) data.trade = body.trade ? String(body.trade) : null;
    if (body.assignedToName !== undefined) data.assignedToName = body.assignedToName ? String(body.assignedToName) : null;
    if (body.assignedToEmail !== undefined) data.assignedToEmail = body.assignedToEmail ? String(body.assignedToEmail).trim().toLowerCase() : null;
    if (body.priority !== undefined && VALID_PRIORITY.includes(body.priority)) data.priority = body.priority;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
    if (body.status !== undefined && VALID_STATUS.includes(body.status)) {
      data.status = body.status;
      if (body.status === 'Completed' && !existing.completedAt) {
        data.completedAt = new Date();
        data.completedByName = (session.user as any)?.name ?? null;
      }
      if (body.status !== 'Completed') {
        data.completedAt = null;
        data.completedByName = null;
      }
    }

    const item = await prisma.punchItem.update({
      where: { id: existing.id },
      data,
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
      },
    });

    return NextResponse.json(item);
  } catch (error: any) {
    console.error('PATCH /api/punch-items/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update punch item' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!guard(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.punchItem.findFirst({
      where: { id: params.id, project: { companyId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.punchItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /api/punch-items/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete punch item' }, { status: 500 });
  }
}
