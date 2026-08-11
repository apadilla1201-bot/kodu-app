export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { RFIListContent } from '@/components/rfi-list-content';
import { requireProjectAccess } from '@/lib/require-project';

export default async function RFIsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const { projectId } = await requireProjectAccess(searchParams);
  const companyId = (session.user as any)?.companyId ?? '';

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    include: {
      rfis: {
        include: { attachments: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!project) redirect('/dashboard');

  const allRfis = (project?.rfis ?? []).map((r: any) => ({
    ...r,
    dateSubmitted: r?.dateSubmitted?.toISOString?.() ?? new Date().toISOString(),
    dateDue: r?.dateDue?.toISOString?.() ?? null,
    responseDate: r?.responseDate?.toISOString?.() ?? null,
    createdAt: r?.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: r?.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    attachments: (r?.attachments ?? []).map((a: any) => ({ ...a, createdAt: a?.createdAt?.toISOString?.() ?? '' })),
    projectName: project?.projectName ?? '',
    projectNumber: project?.projectNumber ?? '',
  }));

  const projectsList = [{ id: project.id, projectNumber: project.projectNumber ?? '', projectName: project.projectName ?? '' }];

  return <RFIListContent rfis={allRfis} projects={projectsList} initialProjectNumber={project.projectNumber ?? ''} />;
}
