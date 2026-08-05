export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { isFullAccess } from '@/lib/permissions';
import { LienWaiversContent } from '@/components/lien-waivers-content';

export default async function LienWaiversPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as any)?.role ?? 'viewer';
  if (!isFullAccess(role)) redirect('/dashboard');
  const companyId = (session.user as any)?.companyId ?? '';

  const projects = await prisma.project.findMany({
    where: { companyId },
    select: {
      id: true,
      projectNumber: true,
      projectName: true,
      payApplications: {
        orderBy: { applicationNumber: 'desc' },
        select: { id: true, applicationNumber: true, periodTo: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = projects.map((p) => ({
    id: p.id,
    projectNumber: p.projectNumber,
    projectName: p.projectName,
    payApplications: p.payApplications.map((pa) => ({
      id: pa.id,
      applicationNumber: pa.applicationNumber,
      periodTo: pa.periodTo?.toISOString() ?? null,
    })),
  }));

  return <LienWaiversContent projects={serialized} />;
}
