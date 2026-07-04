export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generateBuyoutFromBudgetLines } from '@/lib/buyout-generate';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json().catch(() => ({}));
    const projectId = String(body?.projectId || '');
    const replace = body?.replace !== false;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Prefer latest Pay App G703 (same lines as executed budget)
    const latestPa = await prisma.payApplication.findFirst({
      where: { projectId },
      orderBy: { applicationNumber: 'desc' },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    });

    let source: 'pay_app' | 'budget' = 'pay_app';
    let budgetLines = (latestPa?.lineItems ?? []).map((li) => ({
      sortOrder: li.sortOrder,
      itemNumber: li.itemNumber,
      sectionCode: li.sectionCode,
      sectionTitle: li.sectionTitle,
      description: li.description,
      subVendor: li.subVendor,
      scheduledValue: li.scheduledValue,
      budgetRealloc: li.budgetRealloc,
      previousChanges: li.previousChanges,
      currentChanges: li.currentChanges,
      previousCompleted: li.previousCompleted,
      thisCompleted: li.thisCompleted,
      isSection: li.isSection,
      isBelowLine: li.isBelowLine,
      isFee: li.isFee,
    }));

    if (budgetLines.length === 0) {
      const budget = await prisma.budget.findFirst({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!budget?.lineItems?.length) {
        return NextResponse.json(
          { error: 'No Pay Application or Budget found for this project. Import a Pay App first.' },
          { status: 400 },
        );
      }
      source = 'budget';
      budgetLines = budget.lineItems.map((li) => ({
        sortOrder: li.sortOrder,
        itemNumber: li.itemNumber,
        sectionCode: li.divisionCode,
        sectionTitle: '',
        description: li.description,
        subVendor: li.subVendor,
        scheduledValue: li.scheduledValue,
        budgetRealloc: 0,
        previousChanges: 0,
        currentChanges: li.currentChanges,
        previousCompleted: 0,
        thisCompleted: 0,
        isSection: li.isSection,
        isBelowLine: li.isBelowLine,
        isFee: li.isFee,
      }));
    }

    const schedule = await prisma.schedule.findFirst({
      where: { projectId, status: 'Active' },
      orderBy: { updatedAt: 'desc' },
      include: { activities: true },
    });

    const cpmActivities = (schedule?.activities ?? [])
      .filter((a) => !a.isMilestone && a.activityType !== 'wbs')
      .map((a) => ({
        activityName: a.activityName,
        finishDate: a.finishDate,
        startDate: a.startDate,
        wbsCode: a.wbsCode,
        resourceName: a.resourceName,
      }));

    const generated = generateBuyoutFromBudgetLines(budgetLines, cpmActivities);
    if (generated.length === 0) {
      return NextResponse.json({ error: 'No buyout lines could be generated from budget data' }, { status: 400 });
    }

    if (replace) {
      await prisma.buyoutItem.deleteMany({ where: { projectId } });
    }

    await prisma.buyoutItem.createMany({
      data: generated.map((row) => ({
        projectId,
        sortOrder: row.sortOrder,
        lineType: row.lineType,
        divisionCode: row.divisionCode,
        trade: row.trade,
        status: row.status,
        proposalAmount: row.proposalAmount,
        potentialBuyoutAmount: row.potentialBuyoutAmount,
        contractedValue: row.contractedValue,
        pendingCor: row.pendingCor,
        changeOrders: row.changeOrders,
        totalValueBudget: row.totalValueBudget,
        totalByChapter: row.totalByChapter,
        cashFlowInvested: row.cashFlowInvested,
        subcontractor: row.subcontractor,
        dateSubOnSite: row.dateSubOnSite,
        forecastContractDate: row.forecastContractDate,
        notes: row.notes,
      })),
    });

    return NextResponse.json({
      ok: true,
      imported: generated.length,
      source,
      payAppNumber: latestPa?.applicationNumber ?? null,
      cpmRevision: schedule?.revision ?? null,
      cpmActivitiesMatched: generated.filter((r) => r.dateSubOnSite).length,
    });
  } catch (error: any) {
    console.error('POST /api/buyout/generate error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate buyout' }, { status: 500 });
  }
}
