export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const rfi = await prisma.rFI.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
      include: {
        project: true,
        attachments: true,
      },
    });

    if (!rfi) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(rfi);
  } catch (error: any) {
    console.error('GET /api/rfis/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch RFI' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const rfi = await prisma.rFI.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
      include: { project: true },
    });

    if (!rfi) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: any = {};

    const allowedFields = [
      'subject', 'question', 'discipline', 'drawingReference', 'specReference',
      'priority', 'submittedBy', 'submittedByRole', 'assignedTo', 'assignedToRole',
      'daysToRespond', 'costImpact', 'scheduleImpact', 'scheduleImpactDays', 'notes',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updated = await prisma.rFI.update({
      where: { id: params.id },
      data: updateData,
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        attachments: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/rfis/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update RFI' }, { status: 500 });
  }
}


export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role;
    if (role !== 'admin' && role !== 'owner' && role !== 'pm') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const rfi = await prisma.rFI.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
      select: { id: true },
    });

    if (!rfi) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Los adjuntos del RFI se borran primero por si la relación no tiene cascade.
    await prisma.rFIAttachment.deleteMany({ where: { rfiId: rfi.id } });
    await prisma.rFI.delete({ where: { id: rfi.id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /api/rfis/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete RFI' }, { status: 500 });
  }
}
