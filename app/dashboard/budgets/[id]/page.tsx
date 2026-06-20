export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import { BudgetDetailContent } from '@/components/budget-detail-content';

export default async function BudgetDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const budget = await prisma.budget.findUnique({
    where: { id: params?.id ?? '' },
    include: {
      project: { select: { id: true, projectName: true, projectNumber: true, userId: true } },
      lineItems: { orderBy: { sortOrder: 'asc' } },
      detailItems: { orderBy: [{ sheetName: 'asc' }, { sortOrder: 'asc' }] },
    },
  });

  if (!budget || budget.project.userId !== userId) notFound();

  const serialized = {
    ...budget,
    budgetDate: budget.budgetDate ? new Date(budget.budgetDate).toISOString() : '',
    createdAt: budget.createdAt ? new Date(budget.createdAt).toISOString() : '',
    updatedAt: budget.updatedAt ? new Date(budget.updatedAt).toISOString() : '',
    lineItems: budget.lineItems.map((li: any) => ({
      ...li,
      createdAt: li.createdAt ? new Date(li.createdAt).toISOString() : '',
    })),
    detailItems: budget.detailItems.map((di: any) => ({
      ...di,
      createdAt: di.createdAt ? new Date(di.createdAt).toISOString() : '',
    })),
  };

  return <BudgetDetailContent budget={serialized} />;
}
