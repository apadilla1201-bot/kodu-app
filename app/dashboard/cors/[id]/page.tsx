export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import { CORDetailContent } from '@/components/cor-detail-content';

export default async function CORDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const companyId = (session?.user as any)?.companyId ?? '';

  const cor = await prisma.changeOrder.findFirst({
    where: { id: params?.id ?? '', project: { companyId } },
    include: {
      project: { select: { id: true, projectNumber: true, projectName: true, client: true, location: true } },
      lineItems: true,
      marketComparisons: true,
    },
  });

  if (!cor) notFound();

  const serialized = {
    id: cor?.id ?? '',
    corNumber: cor?.corNumber ?? '',
    sequence: cor?.sequence ?? 0,
    date: cor?.date ? new Date(cor.date).toISOString() : '',
    approvalDate: cor?.approvalDate ? new Date(cor.approvalDate).toISOString() : null,
    description: cor?.description ?? '',
    subcontractor: cor?.subcontractor ?? '',
    status: cor?.status ?? 'Pending',
    csiCode: cor?.csiCode ?? '',
    subtotal: cor?.subtotal ?? 0,
    overheadProfit: cor?.overheadProfit ?? 0,
    generalLiability: cor?.generalLiability ?? 0,
    salesTax: cor?.salesTax ?? 0,
    totalAmount: cor?.totalAmount ?? 0,
    reasonForChange: cor?.reasonForChange ?? '',
    reasonsParticular: cor?.reasonsParticular ?? '',
    marketAnalysisNotes: cor?.marketAnalysisNotes ?? '',
    pdfCloudPath: cor?.pdfCloudPath ?? '',
    subPdfCloudPath: cor?.subPdfCloudPath ?? '',
    notes: cor?.notes ?? '',
    project: {
      id: cor?.project?.id ?? '',
      projectNumber: cor?.project?.projectNumber ?? '',
      projectName: cor?.project?.projectName ?? '',
      client: cor?.project?.client ?? '',
      location: cor?.project?.location ?? '',
    },
    lineItems: (cor?.lineItems ?? []).map((li: any) => ({
      id: li?.id ?? '',
      description: li?.description ?? '',
      productCode: li?.productCode ?? '',
      quantity: li?.quantity ?? 0,
      unit: li?.unit ?? '',
      unitPrice: li?.unitPrice ?? 0,
      total: li?.total ?? 0,
      isMaterial: li?.isMaterial ?? true,
    })),
    marketComparisons: (cor?.marketComparisons ?? []).map((mc: any) => ({
      id: mc?.id ?? '',
      itemDescription: mc?.itemDescription ?? '',
      subQuote: mc?.subQuote ?? 0,
      marketAverage: mc?.marketAverage ?? 0,
      variancePercent: mc?.variancePercent ?? 0,
      assessment: mc?.assessment ?? '',
      source: mc?.source ?? '',
    })),
  };

  return <CORDetailContent cor={serialized} />;
}
