export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';

const VALID_STATUS = ['Pending', 'Requested', 'Received', 'Verified'];

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

    const existing = await prisma.closeoutItem.findFirst({
      where: { id: params.id, project: { companyId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const data: any = {};
    if (body.category !== undefined) data.category = String(body.category).trim();
    if (body.deliverable !== undefined) data.deliverable = String(body.deliverable).trim();
    if (body.responsible !== undefined) data.responsible = body.responsible ? String(body.responsible) : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
    if (body.status !== undefined && VALID_STATUS.includes(body.status)) {
      data.status = body.status;
      if ((body.status === 'Received' || body.status === 'Verified') && !existing.dateReceived) {
        data.dateReceived = new Date();
      }
      if (body.status === 'Pending' || body.status === 'Requested') {
        data.dateReceived = null;
      }
    }

    const item = await prisma.closeoutItem.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json(item);
  } catch (error: any) {
    console.error('PATCH /api/closeout-items/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update closeout item' }, { status: 500 });
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

    const existing = await prisma.closeoutItem.findFirst({
      where: { id: params.id, project: { companyId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.closeoutItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /api/closeout-items/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete closeout item' }, { status: 500 });
  }
}
