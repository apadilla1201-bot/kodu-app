export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import NewPayAppForm from '@/components/new-pay-app-form';

export default async function NewPayAppPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      payApplications: {
        select: { applicationNumber: true, id: true },
        orderBy: { applicationNumber: 'desc' },
        take: 1,
      },
    },
    orderBy: { projectName: 'asc' },
  });

  const projectsData = (projects ?? []).map((p: any) => ({
    id: p?.id ?? '',
    projectNumber: p?.projectNumber ?? '',
    projectName: p?.projectName ?? '',
    nextAppNumber: ((p?.payApplications?.[0]?.applicationNumber ?? 0) + 1),
    lastPayAppId: p?.payApplications?.[0]?.id ?? null,
  }));

  return <NewPayAppForm projects={projectsData} initialProjectId={searchParams?.projectId ?? ''} />;
}
