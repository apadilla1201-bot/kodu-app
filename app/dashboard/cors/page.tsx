export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { AllCorsContent } from '@/components/all-cors-content';

export default async function CorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const projects = await prisma.project.findMany({
    where: { userId },
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
    orderBy: { createdAt: 'desc' },
  });

  const data = (projects ?? []).map((p: any) => ({
    id: p?.id ?? '',
    projectNumber: p?.projectNumber ?? '',
    projectName: p?.projectName ?? '',
    changeOrders: (p?.changeOrders ?? []).map((co: any) => ({
      id: co?.id ?? '',
      corNumber: co?.corNumber ?? '',
      date: co?.date ? new Date(co.date).toISOString() : '',
      description: co?.description ?? '',
      subcontractor: co?.subcontractor ?? '',
      status: co?.status ?? 'Pending',
      totalAmount: co?.totalAmount ?? 0,
    })),
  }));

  return <AllCorsContent projects={data} />;
}
