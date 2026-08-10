export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { isFullAccess } from '@/lib/permissions';
import { SubInvoicesContent } from '@/components/sub-invoices-content';
import { COST_CODES } from '@/lib/cost-codes';

export default async function SubInvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as any)?.role ?? 'viewer';
  if (!isFullAccess(role)) redirect('/dashboard');
  const companyId = (session.user as any)?.companyId ?? '';

  const projects = await prisma.project.findMany({
    where: { companyId },
    select: { id: true, projectNumber: true, projectName: true },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = projects.map((p) => ({
    id: p.id,
    projectNumber: p.projectNumber,
    projectName: p.projectName,
  }));

  return <SubInvoicesContent projects={serialized} costCodes={COST_CODES} />;
}
