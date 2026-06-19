export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { RFIListContent } from '@/components/rfi-list-content';

export default async function RFIsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      rfis: {
        include: { attachments: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const allRfis = projects.flatMap((p: any) =>
    (p?.rfis ?? []).map((r: any) => ({
      ...r,
      dateSubmitted: r?.dateSubmitted?.toISOString?.() ?? new Date().toISOString(),
      dateDue: r?.dateDue?.toISOString?.() ?? null,
      responseDate: r?.responseDate?.toISOString?.() ?? null,
      createdAt: r?.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: r?.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      attachments: (r?.attachments ?? []).map((a: any) => ({ ...a, createdAt: a?.createdAt?.toISOString?.() ?? '' })),
      projectName: p?.projectName ?? '',
      projectNumber: p?.projectNumber ?? '',
    }))
  );

  const projectsList = projects.map((p: any) => ({
    id: p?.id ?? '',
    projectNumber: p?.projectNumber ?? '',
    projectName: p?.projectName ?? '',
  }));

  return <RFIListContent rfis={allRfis} projects={projectsList} />;
}
