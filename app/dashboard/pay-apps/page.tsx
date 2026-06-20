export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { PayAppListContent } from '@/components/pay-app-list-content';

export default async function PayAppsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const companyId = (session.user as any)?.companyId ?? '';

  const projects = await prisma.project.findMany({
    where: { companyId },
    include: {
      payApplications: {
        orderBy: { applicationNumber: 'desc' },
        select: {
          id: true,
          applicationNumber: true,
          applicationDate: true,
          periodFrom: true,
          periodTo: true,
          status: true,
          lineItems: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = projects.map(p => ({
    ...p,
    startDate: p.startDate?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    payApplications: p.payApplications.map(pa => ({
      ...pa,
      applicationDate: pa.applicationDate.toISOString(),
      periodFrom: pa.periodFrom.toISOString(),
      periodTo: pa.periodTo.toISOString(),
    })),
  }));

  return <PayAppListContent projects={serialized} />;
}
