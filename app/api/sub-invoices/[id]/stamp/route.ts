export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { uploadBufferToStorage, downloadFileBuffer } from '@/lib/s3';
import { findCostCode } from '@/lib/cost-codes';

/**
 * POST → Estampa en el PDF original del sub la línea roja de contabilidad:
 *   "Project 169, Cost code : 32 39 13, Net Payment : $2,802.50"
 * Réplica exacta de la marca que el PM hoy hace a mano editando el PDF
 * (rojo, Arial ~10, pie de la página 1). Devuelve el invoice actualizado
 * con el PDF sellado (stampedFileUrl).
 *
 * Body opcional: { costCode?, netAmount?, retainagePercent? } para ajustar
 * antes de sellar sin re-subir el invoice.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const invoice = await prisma.subInvoice.findFirst({
      where: { id: params.id, project: { companyId } },
      include: { project: { select: { projectNumber: true, projectName: true, companyId: true } } },
    });
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!invoice.fileUrl) {
      return NextResponse.json({ error: 'This invoice has no PDF to stamp' }, { status: 400 });
    }

    // Ajustes opcionales antes de sellar
    const body = await req.json().catch(() => ({}));
    const costCode = body.costCode != null ? String(body.costCode).trim() : invoice.costCode;
    const retainagePercent = body.retainagePercent != null ? Number(body.retainagePercent) : invoice.retainagePercent;
    const netAmount = body.netAmount != null && body.netAmount !== ''
      ? Number(body.netAmount)
      : (body.retainagePercent != null
          ? Math.round(invoice.grossAmount * (1 - retainagePercent) * 100) / 100
          : invoice.netAmount);

    if (!costCode) {
      return NextResponse.json({ error: 'costCode is required to stamp' }, { status: 400 });
    }

    // 1) Descargar el PDF original
    const originalBuffer = await downloadFileBuffer(invoice.fileUrl);

    // 2) Estampar con pdf-lib (línea roja al pie de la página 1)
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { height } = firstPage.getSize();

    const projectNumber = invoice.project?.projectNumber ?? '';
    const netStr = netAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const stampText = `Project ${projectNumber}, Cost code : ${costCode}, Net Payment : $${netStr}`;

    // Rojo del sello manual (#fc2a1c ≈ rgb(0.988, 0.165, 0.11)), Arial/Helvetica 10
    const fontSize = 10;
    const red = rgb(0.988, 0.165, 0.11);
    const margin = 40;
    const y = Math.max(28, 40); // pie de página (28-40pt desde el borde inferior)

    firstPage.drawText(stampText, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: red,
    });
    // Si el texto se sale del ancho, también lo ponemos en una segunda línea más arriba no es necesario:
    // drawText con fuente 10 en un invoice estándar cabe en la mayoría. Si no, lo truncamos visualmente con maxWidth.
    // (pdf-lib no ajusta automático; para facturas AIA/carta estándar 10pt cabe.)

    const stampedBuffer = Buffer.from(await pdfDoc.save());

    // 3) Subir el PDF sellado
    const stampedFileName = (invoice.fileName ?? 'invoice').replace(/\.pdf$/i, '') + '-STAMPED.pdf';
    const { cloud_storage_path } = await uploadBufferToStorage(stampedBuffer, stampedFileName, 'application/pdf', true);

    const costCodeLabel = findCostCode(costCode)?.label ?? invoice.costCodeLabel ?? null;

    const updated = await prisma.subInvoice.update({
      where: { id: invoice.id },
      data: {
        costCode,
        costCodeLabel,
        retainagePercent,
        netAmount,
        stampedFileUrl: cloud_storage_path,
        stampedFileName,
        status: 'Stamped',
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('sub-invoices stamp error:', err);
    return NextResponse.json({ error: 'Failed to stamp PDF' }, { status: 500 });
  }
}
