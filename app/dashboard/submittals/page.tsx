export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { SubmittalListContent } from '@/components/submittal-list-content';
import { requireProjectAccess } from '@/lib/require-project';

export default async function SubmittalsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const { projectId } = await requireProjectAccess(searchParams);
  const companyId = (session.user as any)?.companyId ?? '';

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    include: { submittals: { orderBy: { createdAt: 'desc' } } },
  });
  if (!project) redirect('/dashboard');

  const allSubmittals = (project.submittals ?? []).map((s) => ({
    ...s,
    requiredDate: s.requiredDate?.toISOString?.() ?? null,
    submittedDate: s.submittedDate?.toISOString?.() ?? null,
    reviewedDate: s.reviewedDate?.toISOString?.() ?? null,
    projectName: project.projectName,
    projectNumber: project.projectNumber,
  }));

  const projectsList = [{ id: project.id, projectNumber: project.projectNumber, projectName: project.projectName }];

  return <SubmittalListContent submittals={allSubmittals} projects={projectsList} initialProjectNumber={project.projectNumber} />;
}
