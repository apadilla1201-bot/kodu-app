export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import {
  buildAlerts,
  computeBudget,
  computeDelta,
  computeRemaining,
  computeRemainingPct,
} from '@/lib/buyout';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const items = await prisma.buyoutItem.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });

    const lineItems = items.filter((i) => i.lineType !== 'Division');
    const totalProposal = lineItems.reduce((s, i) => s + (i.proposalAmount || 0), 0);
    const totalContracted = lineItems.reduce((s, i) => s + (i.contractedValue || 0), 0);
    const totalBudget = lineItems.reduce((s, i) => s + (i.totalValueBudget || 0), 0);
    const totalInvested = lineItems.reduce((s, i) => s + (i.cashFlowInvested || 0), 0);
    const totalRemaining = computeRemaining(totalBudget, totalInvested);

    const byDivision = items
      .filter((i) => i.lineType === 'Division')
      .map((d) => {
        const code = d.divisionCode || d.trade;
        const children = lineItems.filter((i) => i.divisionCode === code || i.divisionCode === d.trade);
        const invested = children.reduce((s, i) => s + (i.cashFlowInvested || 0), 0);
        const budget = d.totalByChapter || children.reduce((s, i) => s + (i.totalValueBudget || 0), 0);
        return {
          name: d.trade,
          code,
          budget,
          invested,
          remaining: budget - invested,
        };
      });

    const alerts = buildAlerts(items);

    const summary = {
      totalLines: lineItems.length,
      totalProposal,
      totalContracted,
      totalBudget,
      totalInvested,
      totalRemaining,
      remainingPct: computeRemainingPct(totalBudget, totalInvested),
      delta: computeDelta(totalBudget, totalProposal),
      alertCount: alerts.length,
      highAlerts: alerts.filter((a) => a.severity === 'high').length,
    };

    return NextResponse.json({
      project: {
        id: project.id,
        projectNumber: project.projectNumber,
        projectName: project.projectName,
      },
      items,
      summary,
      byDivision,
      alerts,
    });
  } catch (error: any) {
    console.error('GET /api/buyout error:', error);
    return NextResponse.json({ error: 'Failed to load buyout' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json();
    const { projectId, ...fields } = body ?? {};
    if (!projectId || !fields.trade) {
      return NextResponse.json({ error: 'projectId and trade are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const last = await prisma.buyoutItem.findFirst({
      where: { projectId },
      orderBy: { sortOrder: 'desc' },
    });

    const totalValueBudget =
      fields.totalValueBudget ??
      computeBudget({
        contractedValue: fields.contractedValue,
        pendingCor: fields.pendingCor,
        changeOrders: fields.changeOrders,
        proposalAmount: fields.proposalAmount,
        potentialBuyoutAmount: fields.potentialBuyoutAmount,
      });

    const item = await prisma.buyoutItem.create({
      data: {
        projectId,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        lineType: fields.lineType ?? 'Trade',
        divisionCode: fields.divisionCode ?? null,
        trade: String(fields.trade),
        status: fields.status ?? 'Not Started',
        proposalAmount: fields.proposalAmount ?? 0,
        proposalDetails: fields.proposalDetails ?? null,
        potentialBuyoutAmount: fields.potentialBuyoutAmount ?? 0,
        potentialBuyoutDetails: fields.potentialBuyoutDetails ?? null,
        contractedValue: fields.contractedValue ?? 0,
        pendingCor: fields.pendingCor ?? 0,
        changeOrders: fields.changeOrders ?? 0,
        totalValueBudget,
        totalByChapter: fields.totalByChapter ?? null,
        cashFlowInvested: fields.cashFlowInvested ?? 0,
        targetContractDate: fields.targetContractDate ? new Date(fields.targetContractDate) : null,
        actualContractDate: fields.actualContractDate ? new Date(fields.actualContractDate) : null,
        dateSubOnSite: fields.dateSubOnSite ? new Date(fields.dateSubOnSite) : null,
        productLeadTimeDays: fields.productLeadTimeDays ?? null,
        approvalLeadTimeDays: fields.approvalLeadTimeDays ?? null,
        finalOwnerApprovalDate: fields.finalOwnerApprovalDate
          ? new Date(fields.finalOwnerApprovalDate)
          : null,
        finalSubmissionApprovalDate: fields.finalSubmissionApprovalDate
          ? new Date(fields.finalSubmissionApprovalDate)
          : null,
        forecastBidDate: fields.forecastBidDate ? new Date(fields.forecastBidDate) : null,
        forecastContractDate: fields.forecastContractDate
          ? new Date(fields.forecastContractDate)
          : null,
        awardDate: fields.awardDate ? new Date(fields.awardDate) : null,
        subcontractor: fields.subcontractor ?? null,
        notes: fields.notes ?? null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/buyout error:', error);
    return NextResponse.json({ error: 'Failed to create buyout item' }, { status: 500 });
  }
}
