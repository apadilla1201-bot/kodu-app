export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { NewRFIForm } from '@/components/new-rfi-form';

export default async function NewRFIPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      rfis: {
        select: { sequence: true },
        orderBy: { sequence: 'desc' },
        take: 1,
      },
    },
    orderBy: { projectNumber: 'asc' },
  });

  const projectsData = projects.map((p: any) => ({
    id: p?.id ?? '',
    projectNumber: p?.projectNumber ?? '',
    projectName: p?.projectName ?? '',
    nextSequence: ((p?.rfis?.[0]?.sequence ?? 0) + 1),
  }));

  return <NewRFIForm projects={projectsData} initialProjectId={searchParams?.projectId ?? ''} />;
}
