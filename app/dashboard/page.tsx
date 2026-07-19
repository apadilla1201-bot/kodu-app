export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { DashboardContent } from '@/components/dashboard-content';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? '';
  const companyId = (session?.user as any)?.companyId ?? '';
  const projectsWithRfis = await prisma.project.findMany({
    where: { companyId },
    include: {
      changeOrders: {
        select: { id: true, status: true, totalAmount: true },
      },
      rfis: {
        select: { id: true, status: true, dateDue: true },
      },
      payApplications: {
        select: { id: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = (projectsWithRfis ?? []).map((p: any) => ({
    id: p?.id ?? '',
    projectNumber: p?.projectNumber ?? '',
    projectName: p?.projectName ?? '',
    client: p?.client ?? '',
    location: p?.location ?? '',
    contractAmount: p?.contractAmount ?? 0,
    totalCORs: p?.changeOrders?.length ?? 0,
    approved: (p?.changeOrders ?? []).filter((c: any) => c?.status === 'Approved')?.length ?? 0,
    pending: (p?.changeOrders ?? []).filter((c: any) => c?.status === 'Pending')?.length ?? 0,
    rejected: (p?.changeOrders ?? []).filter((c: any) => c?.status === 'Rejected')?.length ?? 0,
    totalApprovedAmount: (p?.changeOrders ?? []).filter((c: any) => c?.status === 'Approved').reduce((sum: number, c: any) => sum + (c?.totalAmount ?? 0), 0),
    totalPendingAmount: (p?.changeOrders ?? []).filter((c: any) => c?.status === 'Pending').reduce((sum: number, c: any) => sum + (c?.totalAmount ?? 0), 0),
    totalRFIs: p?.rfis?.length ?? 0,
    openRFIs: (p?.rfis ?? []).filter((r: any) => r?.status === 'Open' || r?.status === 'Under Review')?.length ?? 0,
    overdueRFIs: (p?.rfis ?? []).filter((r: any) =>
      (r?.status === 'Open' || r?.status === 'Under Review') &&
      r?.dateDue && new Date(r.dateDue).getTime() < Date.now()
    )?.length ?? 0,
    totalPayApps: p?.payApplications?.length ?? 0,
  }));

  return <DashboardContent projects={serialized} />;
}
