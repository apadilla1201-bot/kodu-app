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
    const userId = (session.user as any)?.id ?? '';

    const rfi = await prisma.rFI.findUnique({
      where: { id: params?.id ?? '' },
      include: {
        project: true,
        attachments: true,
      },
    });

    if (!rfi || rfi?.project?.userId !== userId) {
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
    const userId = (session.user as any)?.id ?? '';

    const rfi = await prisma.rFI.findUnique({
      where: { id: params?.id ?? '' },
      include: { project: true },
    });

    if (!rfi || rfi?.project?.userId !== userId) {
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
