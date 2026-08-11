export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { PayAppListContent } from '@/components/pay-app-list-content';
import { requireProjectAccess } from '@/lib/require-project';

export default async function PayAppsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const { projectId } = await requireProjectAccess(searchParams);
  const companyId = (session.user as any)?.companyId ?? '';

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
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
  });
  if (!project) redirect('/dashboard');

  const serialized = [{
    ...project,
    startDate: project.startDate?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    payApplications: project.payApplications.map(pa => ({
      ...pa,
      applicationDate: pa.applicationDate.toISOString(),
      periodFrom: pa.periodFrom.toISOString(),
      periodTo: pa.periodTo.toISOString(),
    })),
  }];

  return <PayAppListContent projects={serialized} initialProjectId={project.id} />;
}
