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
    const body = await request.json();
    const { status } = body ?? {};
    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const companyId = (session.user as any)?.companyId ?? '';

    const co = await prisma.changeOrder.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
    });
    if (!co) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.changeOrder.update({
      where: { id: params?.id ?? '' },
      data: {
        status,
        approvalDate: status === 'Approved' ? new Date() : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
