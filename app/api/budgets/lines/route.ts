export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET /api/budgets/lines?projectId=X
// Devuelve el budget mas reciente del proyecto con sus lineItems (para armar un PA manual
// basado solo en partidas del budget) + las lineas del ultimo PA (para heredar lo cobrado).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session?.user as any)?.companyId ?? '';
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const budget = await prisma.budget.findFirst({
    where: { projectId },
    orderBy: { budgetDate: 'desc' },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  });

  // Solo CORs APROBADAS pueden aparecer en el Pay Application
  const approvedCors = await prisma.changeOrder.findMany({
    where: { projectId, status: 'Approved' },
    select: { corNumber: true, csiCode: true, totalAmount: true },
    orderBy: { sequence: 'asc' },
  });

  const lastPa = await prisma.payApplication.findFirst({
    where: { projectId },
    orderBy: { applicationNumber: 'desc' },
    include: { lineItems: { where: { isSection: false } } },
  });

  return NextResponse.json({
    budget: budget
      ? {
          id: budget.id,
          version: budget.version,
          budgetDate: budget.budgetDate,
          constructionSubtotal: budget.constructionSubtotal,
          opPercent: budget.opPercent,
          glPercent: budget.glPercent,
          contingencyPercent: budget.contingencyPercent,
          opAmount: budget.opAmount,
          glAmount: budget.glAmount,
          contingencyAmount: budget.contingencyAmount,
          grandTotal: budget.grandTotal,
          lineItems: budget.lineItems,
        }
      : null,
    lastPaLines: lastPa?.lineItems ?? [],
    lastPaNumber: lastPa?.applicationNumber ?? null,
    approvedCors,
  });
}
