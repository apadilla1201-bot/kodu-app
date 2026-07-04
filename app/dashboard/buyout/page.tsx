export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { BuyoutContent } from '@/components/buyout-content';

export default async function BuyoutPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const companyId = (session.user as any)?.companyId ?? '';

  const projects = await prisma.project.findMany({
    where: { companyId },
    select: { id: true, projectNumber: true, projectName: true },
    orderBy: { projectNumber: 'asc' },
  });

  return (
    <div className="p-6 lg:p-8">
      <BuyoutContent
        projects={projects}
        initialProjectId={searchParams?.projectId}
      />
    </div>
  );
}
