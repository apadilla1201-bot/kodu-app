export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import { SubmittalDetailContent } from '@/components/submittal-detail-content';

export default async function SubmittalDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const companyId = (session.user as any)?.companyId ?? '';

  const submittal = await prisma.submittal.findFirst({
    where: { id: params?.id ?? '', project: { companyId } },
    include: { project: true, attachments: true },
  });

  if (!submittal) notFound();

  const serialized = {
    ...submittal,
    requiredDate: submittal.requiredDate?.toISOString?.() ?? null,
    submittedDate: submittal.submittedDate?.toISOString?.() ?? null,
    reviewedDate: submittal.reviewedDate?.toISOString?.() ?? null,
    createdAt: submittal.createdAt.toISOString(),
    updatedAt: submittal.updatedAt.toISOString(),
    attachments: submittal.attachments.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  return <SubmittalDetailContent submittal={serialized} />;
}
