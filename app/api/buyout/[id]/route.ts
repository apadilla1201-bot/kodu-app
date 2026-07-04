export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { computeBudget } from '@/lib/buyout';

const DATE_FIELDS = [
  'targetContractDate',
  'actualContractDate',
  'dateSubOnSite',
  'finalOwnerApprovalDate',
  'finalSubmissionApprovalDate',
  'forecastBidDate',
  'forecastContractDate',
  'awardDate',
] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.buyoutItem.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = [
      'sortOrder', 'lineType', 'divisionCode', 'trade', 'status',
      'proposalAmount', 'proposalDetails', 'potentialBuyoutAmount', 'potentialBuyoutDetails',
      'contractedValue', 'pendingCor', 'changeOrders', 'totalValueBudget', 'totalByChapter',
      'cashFlowInvested', 'productLeadTimeDays', 'approvalLeadTimeDays',
      'subcontractor', 'notes',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    for (const f of DATE_FIELDS) {
      if (body[f] !== undefined) {
        data[f] = body[f] ? new Date(body[f]) : null;
      }
    }

    if (
      data.totalValueBudget === undefined &&
      (data.contractedValue !== undefined ||
        data.pendingCor !== undefined ||
        data.changeOrders !== undefined ||
        data.proposalAmount !== undefined ||
        data.potentialBuyoutAmount !== undefined)
    ) {
      data.totalValueBudget = computeBudget({
        contractedValue: (data.contractedValue as number) ?? existing.contractedValue,
        pendingCor: (data.pendingCor as number) ?? existing.pendingCor,
        changeOrders: (data.changeOrders as number) ?? existing.changeOrders,
        proposalAmount: (data.proposalAmount as number) ?? existing.proposalAmount,
        potentialBuyoutAmount:
          (data.potentialBuyoutAmount as number) ?? existing.potentialBuyoutAmount,
      });
    }

    const updated = await prisma.buyoutItem.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/buyout/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update buyout item' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.buyoutItem.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.buyoutItem.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/buyout/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete buyout item' }, { status: 500 });
  }
}
