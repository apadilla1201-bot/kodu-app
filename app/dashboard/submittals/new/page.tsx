export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { NewSubmittalForm } from '@/components/new-submittal-form';

export default async function NewSubmittalPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const companyId = (session.user as any)?.companyId ?? '';

  const projects = await prisma.project.findMany({
    where: { companyId },
    include: { _count: { select: { submittals: true } } },
    orderBy: { projectNumber: 'asc' },
  });

  const projectData = projects.map((p) => ({
    id: p.id,
    projectNumber: p.projectNumber,
    projectName: p.projectName,
    nextSequence: p._count.submittals + 1,
  }));

  return (
    <NewSubmittalForm
      projects={projectData}
      initialProjectId={searchParams?.projectId}
    />
  );
}
