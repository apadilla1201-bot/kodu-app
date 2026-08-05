export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';

const VALID_TYPES = [
  'conditional_progress',
  'unconditional_progress',
  'conditional_final',
  'unconditional_final',
];
const VALID_STATUS = ['Pending', 'Sent', 'Received', 'Approved'];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.lienWaiver.findFirst({
      where: { id: params.id, project: { companyId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const data: any = {};
    if (body.subcontractor !== undefined) data.subcontractor = String(body.subcontractor).trim();
    if (body.subEmail !== undefined) data.subEmail = body.subEmail ? String(body.subEmail).trim().toLowerCase() : null;
    if (body.waiverType !== undefined && VALID_TYPES.includes(body.waiverType)) data.waiverType = body.waiverType;
    if (body.amount !== undefined) data.amount = Number(body.amount) || 0;
    if (body.throughDate !== undefined) data.throughDate = body.throughDate ? new Date(body.throughDate) : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
    if (body.payApplicationId !== undefined) {
      if (body.payApplicationId) {
        const pa = await prisma.payApplication.findFirst({
          where: { id: String(body.payApplicationId), projectId: existing.projectId },
        });
        data.payApplicationId = pa ? pa.id : null;
      } else {
        data.payApplicationId = null;
      }
    }
    if (body.status !== undefined && VALID_STATUS.includes(body.status)) {
      data.status = body.status;
      if (body.status === 'Received' && !existing.receivedAt) data.receivedAt = new Date();
    }

    const waiver = await prisma.lienWaiver.update({
      where: { id: existing.id },
      data,
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        payApplication: { select: { id: true, applicationNumber: true, periodTo: true } },
      },
    });

    return NextResponse.json(waiver);
  } catch (error: any) {
    console.error('PATCH /api/lien-waivers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update lien waiver' }, { status: 500 });
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
    if (!isFullAccess(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await prisma.lienWaiver.findFirst({
      where: { id: params.id, project: { companyId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.lienWaiver.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /api/lien-waivers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete lien waiver' }, { status: 500 });
  }
}
