export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const submittal = await prisma.submittal.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
      include: { project: true, attachments: true },
    });

    if (!submittal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(submittal);
  } catch (error: any) {
    console.error('GET /api/submittals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch submittal' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.submittal.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = [
      'title', 'description', 'submittalType', 'specSection', 'subcontractor',
      'priority', 'status', 'submittedBy', 'reviewedBy', 'notes',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.requiredDate !== undefined) {
      data.requiredDate = body.requiredDate ? new Date(body.requiredDate) : null;
    }
    if (body.status === 'Submitted' && existing.status === 'Draft') {
      data.submittedDate = new Date();
    }
    if (body.status === 'Approved' || body.status === 'Revise and Resubmit') {
      data.reviewedDate = new Date();
      data.reviewedBy = body.reviewedBy ?? session.user?.name ?? null;
    }

    const updated = await prisma.submittal.update({
      where: { id: params.id },
      data,
      include: { project: true, attachments: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/submittals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update submittal' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.submittal.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.submittal.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/submittals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete submittal' }, { status: 500 });
  }
}
