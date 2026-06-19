export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { ProjectsListContent } from '@/components/projects-list-content';

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? '';

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      changeOrders: { select: { id: true, status: true, totalAmount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = (projects ?? []).map((p: any) => ({
    id: p?.id ?? '',
    projectNumber: p?.projectNumber ?? '',
    projectName: p?.projectName ?? '',
    client: p?.client ?? '',
    location: p?.location ?? '',
    contractAmount: p?.contractAmount ?? 0,
    startDate: p?.startDate ? new Date(p.startDate).toISOString() : null,
    totalCORs: p?.changeOrders?.length ?? 0,
    approved: (p?.changeOrders ?? []).filter((c: any) => c?.status === 'Approved')?.length ?? 0,
    pending: (p?.changeOrders ?? []).filter((c: any) => c?.status === 'Pending')?.length ?? 0,
    rejected: (p?.changeOrders ?? []).filter((c: any) => c?.status === 'Rejected')?.length ?? 0,
    totalApprovedAmount: (p?.changeOrders ?? []).filter((c: any) => c?.status === 'Approved').reduce((s: number, c: any) => s + (c?.totalAmount ?? 0), 0),
  }));

  return <ProjectsListContent projects={serialized} />;
}
