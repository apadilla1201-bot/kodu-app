export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { isFullAccess } from '@/lib/permissions';
import { PunchListContent } from '@/components/punch-list-content';
import { requireProjectAccess } from '@/lib/require-project';

export default async function PunchListPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as any)?.role ?? 'viewer';
  if (!isFullAccess(role) && role !== 'superintendent') redirect('/dashboard');
  const { projectId } = await requireProjectAccess(searchParams);
  const companyId = (session.user as any)?.companyId ?? '';

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: {
      id: true,
      projectNumber: true,
      projectName: true,
      contacts: {
        where: { isActive: true },
        select: { name: true, email: true, company: true, role: true },
        orderBy: { name: 'asc' },
      },
    },
  });
  if (!project) redirect('/dashboard');

  const serialized = [{
    id: project.id,
    projectNumber: project.projectNumber,
    projectName: project.projectName,
    contacts: project.contacts,
  }];

  return <PunchListContent projects={serialized} initialProjectId={project.id} />;
}
