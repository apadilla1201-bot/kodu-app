export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { isFullAccess } from '@/lib/permissions';
import { LienWaiversContent } from '@/components/lien-waivers-content';
import { requireProjectAccess } from '@/lib/require-project';

export default async function LienWaiversPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as any)?.role ?? 'viewer';
  if (!isFullAccess(role)) redirect('/dashboard');
  const { projectId } = await requireProjectAccess(searchParams);
  const companyId = (session.user as any)?.companyId ?? '';

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: {
      id: true,
      projectNumber: true,
      projectName: true,
      payApplications: {
        orderBy: { applicationNumber: 'desc' },
        select: { id: true, applicationNumber: true, periodTo: true },
      },
    },
  });
  if (!project) redirect('/dashboard');

  const serialized = [{
    id: project.id,
    projectNumber: project.projectNumber,
    projectName: project.projectName,
    payApplications: project.payApplications.map((pa) => ({
      id: pa.id,
      applicationNumber: pa.applicationNumber,
      periodTo: pa.periodTo?.toISOString() ?? null,
    })),
  }];

  return <LienWaiversContent projects={serialized} initialProjectId={project.id} />;
}
