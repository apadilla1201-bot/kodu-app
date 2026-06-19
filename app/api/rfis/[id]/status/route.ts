export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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
    const validStatuses = ['Open', 'Under Review', 'Answered', 'Closed'];
    const newStatus = body?.status;

    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await prisma.rFI.update({
      where: { id: params.id },
      data: { status: newStatus },
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        attachments: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/rfis/[id]/status error:', error);
    return NextResponse.json({ error: 'Failed to update RFI status' }, { status: 500 });
  }
}
