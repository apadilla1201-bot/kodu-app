export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { isFullAccess } from '@/lib/permissions';
import { PlanRoomContent } from '@/components/plan-room-content';

export default async function PlansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as any)?.role ?? 'viewer';
  if (!isFullAccess(role) && role !== 'superintendent') redirect('/dashboard');
  const companyId = (session.user as any)?.companyId ?? '';

  const projects = await prisma.project.findMany({
    where: { companyId },
    select: { id: true, projectNumber: true, projectName: true },
    orderBy: { createdAt: 'desc' },
  });

  return <PlanRoomContent projects={projects} />;
}
