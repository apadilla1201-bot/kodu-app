export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session?.user as any)?.companyId ?? '';
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  const where: any = { project: { companyId } };
  if (projectId) where.projectId = projectId;

  const budgets = await prisma.budget.findMany({
    where,
    include: { project: { select: { projectName: true, projectNumber: true } }, _count: { select: { lineItems: true, detailItems: true } } },
    orderBy: { budgetDate: 'desc' },
  });
  return NextResponse.json(budgets);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { projectId, version, budgetDate, totalACSF, sfRate, constructionSubtotal, furnishingsSubtotal,
    subTotalAll, opPercent, glPercent, contingencyPercent, opAmount, glAmount, contingencyAmount,
    grandTotal, exclusions, assumptions, notes, lineItems, detailItems } = body;

  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const companyId = (session?.user as any)?.companyId ?? '';
  // Verify project ownership
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const budget = await prisma.budget.create({
    data: {
      projectId,
      version: version || '1.0',
      budgetDate: budgetDate ? new Date(budgetDate) : new Date(),
      totalACSF: totalACSF || null,
      sfRate: sfRate || null,
      constructionSubtotal: constructionSubtotal || 0,
      furnishingsSubtotal: furnishingsSubtotal || 0,
      subTotalAll: subTotalAll || 0,
      opPercent: opPercent ?? 0.08,
      glPercent: glPercent ?? 0.02,
      contingencyPercent: contingencyPercent ?? 0.10,
      opAmount: opAmount || 0,
      glAmount: glAmount || 0,
      contingencyAmount: contingencyAmount || 0,
      grandTotal: grandTotal || 0,
      exclusions: exclusions || null,
      assumptions: assumptions || null,
      notes: notes || null,
      lineItems: lineItems?.length ? {
        create: lineItems.map((li: any, i: number) => ({
          sortOrder: li.sortOrder ?? i,
          divisionCode: li.divisionCode || '',
          itemNumber: li.itemNumber || '',
          description: li.description || '',
          subVendor: li.subVendor || '',
          scheduledValue: li.scheduledValue || 0,
          currentChanges: li.currentChanges || 0,
          revisedValue: li.revisedValue || 0,
          percentTotal: li.percentTotal || 0,
          isSection: li.isSection || false,
          isSubtotal: li.isSubtotal || false,
          isFee: li.isFee || false,
          isBelowLine: li.isBelowLine || false,
        }))
      } : undefined,
      detailItems: detailItems?.length ? {
        create: detailItems.map((di: any, i: number) => ({
          sheetName: di.sheetName || 'GCs',
          sortOrder: di.sortOrder ?? i,
          status: di.status || '',
          itemCode: di.itemCode || '',
          description: di.description || '',
          quantity: di.quantity || 0,
          unit: di.unit || '',
          laborUnit: di.laborUnit || 0,
          laborTotal: di.laborTotal || 0,
          materialUnit: di.materialUnit || 0,
          materialTotal: di.materialTotal || 0,
          equipmentUnit: di.equipmentUnit || 0,
          equipmentTotal: di.equipmentTotal || 0,
          subUnit: di.subUnit || 0,
          subTotal: di.subTotal || 0,
          totalUnitCost: di.totalUnitCost || 0,
          totalCost: di.totalCost || 0,
          isHeader: di.isHeader || false,
        }))
      } : undefined,
    },
    include: { lineItems: true, _count: { select: { detailItems: true } } },
  });

  return NextResponse.json(budget, { status: 201 });
}
