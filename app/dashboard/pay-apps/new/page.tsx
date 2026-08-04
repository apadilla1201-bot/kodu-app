export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import NewPayAppForm from '@/components/new-pay-app-form';

export default async function NewPayAppPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const companyId = (session.user as any)?.companyId ?? '';

  const projects = await prisma.project.findMany({
    where: { companyId },
    include: {
      payApplications: {
        select: { applicationNumber: true, id: true, directPayments: true, directPaymentsCurrent: true },
        orderBy: { applicationNumber: 'desc' },
        take: 1,
      },
    },
    orderBy: { projectName: 'asc' },
  });

  const projectsData = (projects ?? []).map((p: any) => {
    const lastPa = p?.payApplications?.[0];
    // Acumulado "Paid by Owner" actual del proyecto: 7b + 7c de la última PA
    const paidByOwnerToDate = lastPa
      ? (lastPa.directPayments ?? 0) + (lastPa.directPaymentsCurrent ?? 0)
      : 0;
    return {
      id: p?.id ?? '',
      projectNumber: p?.projectNumber ?? '',
      projectName: p?.projectName ?? '',
      nextAppNumber: ((lastPa?.applicationNumber ?? 0) + 1),
      lastPayAppId: lastPa?.id ?? null,
      paidByOwnerToDate,
    };
  });

  return <NewPayAppForm projects={projectsData} initialProjectId={searchParams?.projectId ?? ''} />;
}
