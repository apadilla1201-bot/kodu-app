export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { CORWizard } from '@/components/cor-wizard';

export default async function NewCORPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      changeOrders: {
        select: { sequence: true },
        orderBy: { sequence: 'desc' },
        take: 1,
      },
    },
    orderBy: { projectName: 'asc' },
  });

  const projectsData = (projects ?? []).map((p: any) => ({
    id: p?.id ?? '',
    projectNumber: p?.projectNumber ?? '',
    projectName: p?.projectName ?? '',
    client: p?.client ?? '',
    location: p?.location ?? '',
    nextSequence: ((p?.changeOrders?.[0]?.sequence ?? 0) + 1),
  }));

  return <CORWizard projects={projectsData} initialProjectId={searchParams?.projectId ?? ''} />;
}
