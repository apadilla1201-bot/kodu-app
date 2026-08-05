export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { isFullAccess } from '@/lib/permissions';
import { PunchListContent } from '@/components/punch-list-content';

export default async function PunchListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as any)?.role ?? 'viewer';
  // Gestión completa + superintendente (su trabajo diario de campo)
  if (!isFullAccess(role) && role !== 'superintendent') redirect('/dashboard');
  const companyId = (session.user as any)?.companyId ?? '';

  const projects = await prisma.project.findMany({
    where: { companyId },
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
    orderBy: { createdAt: 'desc' },
  });

  const serialized = projects.map((p) => ({
    id: p.id,
    projectNumber: p.projectNumber,
    projectName: p.projectName,
    contacts: p.contacts,
  }));

  return <PunchListContent projects={serialized} />;
}
