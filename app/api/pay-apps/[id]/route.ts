export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const pa = await prisma.payApplication.findFirst({
      where: { id: params.id, project: { companyId } },
      include: { project: true, lineItems: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!pa) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(pa);
  } catch (error: any) {
    console.error('GET /api/pay-apps/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const pa = await prisma.payApplication.findFirst({
      where: { id: params.id, project: { companyId } },
      include: { project: true },
    });
    if (!pa) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { lineItems, ...updates } = body;

    // Convert dates
    if (updates.applicationDate) updates.applicationDate = new Date(updates.applicationDate);
    if (updates.periodFrom) updates.periodFrom = new Date(updates.periodFrom);
    if (updates.periodTo) updates.periodTo = new Date(updates.periodTo);
    if (updates.contractDate) updates.contractDate = new Date(updates.contractDate);

    // Update line items if provided
    if (lineItems && Array.isArray(lineItems)) {
      await prisma.payAppLineItem.deleteMany({ where: { payApplicationId: params.id } });
      await prisma.payAppLineItem.createMany({
        data: lineItems.map((li: any, i: number) => ({
          payApplicationId: params.id,
          sortOrder: li.sortOrder ?? i + 1,
          itemNumber: String(li.itemNumber ?? ''),
          sectionCode: String(li.sectionCode ?? ''),
          sectionTitle: String(li.sectionTitle ?? ''),
          description: String(li.description ?? ''),
          subVendor: String(li.subVendor ?? ''),
          scheduledValue: Number(li.scheduledValue) || 0,
          budgetRealloc: Number(li.budgetRealloc) || 0,
          previousChanges: Number(li.previousChanges) || 0,
          currentChanges: Number(li.currentChanges) || 0,
          previousCompleted: Number(li.previousCompleted) || 0,
          thisCompleted: Number(li.thisCompleted) || 0,
          retainage: Number(li.retainage) || 0,
          isSection: li.isSection === true,
          isBelowLine: li.isBelowLine === true,
          isFee: li.isFee === true,
        })),
      });
    }

    const updated = await prisma.payApplication.update({
      where: { id: params.id },
      data: updates,
      include: { project: true, lineItems: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/pay-apps/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const pa = await prisma.payApplication.findFirst({
      where: { id: params.id, project: { companyId } },
      include: { project: true },
    });
    if (!pa) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.payApplication.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/pay-apps/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
