export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { RFIDetailContent } from '@/components/rfi-detail-content';

export default async function RFIDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const companyId = (session?.user as any)?.companyId ?? '';

  const rfi = await prisma.rFI.findFirst({
    where: { id: params?.id ?? '', project: { companyId } },
    include: {
      project: true,
      attachments: true,
    },
  });

  if (!rfi) {
    notFound();
  }

  const serialized = {
    ...rfi,
    dateSubmitted: rfi?.dateSubmitted?.toISOString?.() ?? new Date().toISOString(),
    dateDue: rfi?.dateDue?.toISOString?.() ?? null,
    responseDate: rfi?.responseDate?.toISOString?.() ?? null,
    createdAt: rfi?.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: rfi?.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    project: {
      ...rfi.project,
      startDate: rfi?.project?.startDate?.toISOString?.() ?? null,
      createdAt: rfi?.project?.createdAt?.toISOString?.() ?? '',
      updatedAt: rfi?.project?.updatedAt?.toISOString?.() ?? '',
    },
    attachments: (rfi?.attachments ?? []).map((a: any) => ({ ...a, createdAt: a?.createdAt?.toISOString?.() ?? '' })),
  };

  return <RFIDetailContent rfi={serialized} />;
}
