export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/s3';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any)?.id ?? '';

    const cor = await prisma.changeOrder.findUnique({
      where: { id: params?.id ?? '' },
      include: { project: true, lineItems: true, marketComparisons: true },
    });

    if (!cor || cor?.project?.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(cor);
  } catch (error: any) {
    console.error('GET /api/cors/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch COR' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any)?.id ?? '';

    const cor = await prisma.changeOrder.findUnique({
      where: { id: params?.id ?? '' },
      include: { project: true, lineItems: true },
    });

    if (!cor || cor?.project?.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      description, subcontractor, date, csiCode, notes,
      reasonForChange, reasonsParticular, marketAnalysisNotes,
      lineItems, subPdfCloudPath, subPdfIsPublic,
      directTotalAmount, approvalDate,
    } = body ?? {};

    // Recalculate financials from line items if provided
    let updateData: any = {};

    if (description !== undefined) updateData.description = String(description);
    if (subcontractor !== undefined) updateData.subcontractor = subcontractor ? String(subcontractor) : null;
    if (date !== undefined) updateData.date = new Date(date);
    if (csiCode !== undefined) updateData.csiCode = csiCode ? String(csiCode) : null;
    if (notes !== undefined) updateData.notes = notes ? String(notes) : null;
    if (reasonForChange !== undefined) updateData.reasonForChange = reasonForChange ? String(reasonForChange) : null;
    if (reasonsParticular !== undefined) updateData.reasonsParticular = reasonsParticular ? String(reasonsParticular) : null;
    if (marketAnalysisNotes !== undefined) updateData.marketAnalysisNotes = marketAnalysisNotes ? String(marketAnalysisNotes) : null;
    if (approvalDate !== undefined) updateData.approvalDate = approvalDate ? new Date(approvalDate) : null;

    // Handle subcontractor PDF path updates
    if (subPdfCloudPath !== undefined) {
      // Delete old PDF from S3 if there was one and it's being replaced or removed
      const oldPdfPath = cor?.subPdfCloudPath;
      if (oldPdfPath && oldPdfPath !== subPdfCloudPath) {
        try {
          await deleteFile(oldPdfPath);
          console.log('[PATCH COR] Deleted old sub PDF:', oldPdfPath);
        } catch (delErr: any) {
          console.error('[PATCH COR] Failed to delete old sub PDF:', delErr?.message);
          // Continue anyway — don't block the update
        }
      }
      updateData.subPdfCloudPath = subPdfCloudPath ? String(subPdfCloudPath) : null;
      updateData.subPdfIsPublic = subPdfIsPublic ?? false;
    }

    // If line items are provided, replace them and recalculate
    if (lineItems && Array.isArray(lineItems)) {
      // Delete existing line items
      await prisma.lineItem.deleteMany({ where: { changeOrderId: params.id } });

      // Create new ones
      const newItems = lineItems.map((li: any) => ({
        changeOrderId: params.id,
        description: String(li?.description ?? ''),
        productCode: li?.productCode ? String(li.productCode) : null,
        quantity: Number(li?.quantity ?? 1),
        unit: String(li?.unit ?? 'EA'),
        unitPrice: Number(li?.unitPrice ?? 0),
        total: Number(li?.total ?? 0),
        isMaterial: li?.isMaterial !== false,
      }));

      if (newItems.length > 0) {
        await prisma.lineItem.createMany({ data: newItems });
      }

      // Recalculate financials
      const materialItems = newItems.filter((li: any) => li.isMaterial);
      const subtotal = materialItems.reduce((sum: number, li: any) => sum + (li.total || 0), 0);
      const nonMaterialTotal = newItems.filter((li: any) => !li.isMaterial).reduce((sum: number, li: any) => sum + (li.total || 0), 0);
      const salesTax = subtotal * 0.07;
      const supplierTotal = subtotal + salesTax + nonMaterialTotal;
      const overheadProfit = supplierTotal * 0.06;
      const generalLiability = supplierTotal * 0.015;
      const totalAmount = supplierTotal + overheadProfit + generalLiability;

      updateData.subtotal = subtotal + nonMaterialTotal;
      updateData.salesTax = salesTax;
      updateData.overheadProfit = overheadProfit;
      updateData.generalLiability = generalLiability;
      updateData.totalAmount = totalAmount;
    }

    // Direct total amount override (for CORs without line items)
    if (directTotalAmount !== undefined && !lineItems) {
      const amt = Number(directTotalAmount) || 0;
      updateData.totalAmount = amt;
      // Back-calculate approximate breakdown
      // total = supplierTotal * 1.075  (6% O&P + 1.5% GL)
      const supplierTotal = amt / 1.075;
      updateData.overheadProfit = supplierTotal * 0.06;
      updateData.generalLiability = supplierTotal * 0.015;
      // remaining is subtotal + tax
      const subPlusTax = supplierTotal;
      // subtotal + subtotal*0.07 = subPlusTax => subtotal = subPlusTax / 1.07
      const subtotal = subPlusTax / 1.07;
      updateData.subtotal = subtotal;
      updateData.salesTax = subtotal * 0.07;
    }

    const updated = await prisma.changeOrder.update({
      where: { id: params.id },
      data: updateData,
      include: { project: true, lineItems: true, marketComparisons: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/cors/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update COR' }, { status: 500 });
  }
}
