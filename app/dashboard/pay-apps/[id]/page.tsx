export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { PayAppDetailContent } from '@/components/pay-app-detail-content';

export default async function PayAppDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const pa = await prisma.payApplication.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      lineItems: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!pa || pa.project?.userId !== userId) notFound();

  const serialized = {
    ...pa,
    applicationDate: pa.applicationDate.toISOString(),
    periodFrom: pa.periodFrom.toISOString(),
    periodTo: pa.periodTo.toISOString(),
    contractDate: pa.contractDate?.toISOString() ?? null,
    createdAt: pa.createdAt.toISOString(),
    updatedAt: pa.updatedAt.toISOString(),
    project: {
      ...pa.project,
      startDate: pa.project.startDate?.toISOString() ?? null,
      createdAt: pa.project.createdAt.toISOString(),
      updatedAt: pa.project.updatedAt.toISOString(),
    },
    lineItems: pa.lineItems.map(li => ({
      ...li,
      createdAt: li.createdAt.toISOString(),
    })),
  };

  return <PayAppDetailContent payApp={serialized} />;
}
