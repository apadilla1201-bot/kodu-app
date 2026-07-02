export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session?.user as any)?.companyId ?? '';

  const budget = await prisma.budget.findFirst({
    where: { id: params.id, project: { companyId } },
    include: {
      project: { select: { projectName: true, projectNumber: true } },
      lineItems: { orderBy: { sortOrder: 'asc' } },
      detailItems: { orderBy: [{ sheetName: 'asc' }, { sortOrder: 'asc' }] },
    },
  });
  if (!budget) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(budget);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session?.user as any)?.companyId ?? '';

  const budget = await prisma.budget.findFirst({
    where: { id: params.id, project: { companyId } },
  });
  if (!budget) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const { version, status, notes, exclusions, assumptions } = body;
  const updateData: any = {};
  if (version !== undefined) updateData.version = version;
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (exclusions !== undefined) updateData.exclusions = exclusions;
  if (assumptions !== undefined) updateData.assumptions = assumptions;

  const updated = await prisma.budget.update({ where: { id: params.id }, data: updateData });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session?.user as any)?.companyId ?? '';

  const budget = await prisma.budget.findFirst({
    where: { id: params.id, project: { companyId } },
  });
  if (!budget) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.budget.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
