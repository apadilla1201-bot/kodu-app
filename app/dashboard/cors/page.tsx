export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { AllCorsContent } from '@/components/all-cors-content';
import { requireProjectAccess } from '@/lib/require-project';

export default async function CorsPage({ searchParams }: { searchParams: { projectId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const { projectId } = await requireProjectAccess(searchParams);
  const companyId = (session.user as any)?.companyId ?? '';

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    include: {
      changeOrders: {
        orderBy: { sequence: 'asc' },
        select: {
          id: true, corNumber: true, date: true, description: true,
          subcontractor: true, status: true, totalAmount: true, subtotal: true,
          overheadProfit: true, generalLiability: true,
        },
      },
    },
  });
  if (!project) redirect('/dashboard');

  const data = [{
    id: project.id,
    projectNumber: project.projectNumber ?? '',
    projectName: project.projectName ?? '',
    changeOrders: (project.changeOrders ?? []).map((co: any) => ({
      id: co?.id ?? '',
      corNumber: co?.corNumber ?? '',
      date: co?.date ? new Date(co.date).toISOString() : '',
      description: co?.description ?? '',
      subcontractor: co?.subcontractor ?? '',
      status: co?.status ?? 'Pending',
      totalAmount: co?.totalAmount ?? 0,
    })),
  }];

  return <AllCorsContent projects={data} initialProjectId={project.id} />;
}
