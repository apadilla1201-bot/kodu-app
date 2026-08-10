export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { downloadFileBuffer } from '@/lib/s3';
import { sendEmail, buildBrandedEmailHtml } from '@/lib/email';

/**
 * POST → Envía a contabilidad el PDF SELLADO (con cost code + neto) por correo.
 * Asunto estándar: "Invoice — SUB — Proyecto (N) — Net $X — CC Y".
 * Body: { to: string (email contabilidad), cc?: string, note?: string }
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

    // Necesita el PDF sellado (o al menos el original si aún no se selló)
    const pdfPath = invoice.stampedFileUrl ?? invoice.fileUrl;
    if (!pdfPath) {
      return NextResponse.json({ error: 'No PDF to send — upload the sub invoice first' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const to = String(body.to ?? '').trim();
    if (!to) return NextResponse.json({ error: 'Accounting email (to) is required' }, { status: 400 });
    const cc = body.cc ? String(body.cc).trim() : undefined;
    const note = body.note ? String(body.note).trim() : '';

    const projectNumber = invoice.project?.projectNumber ?? '';
    const projectName = invoice.project?.projectName ?? '';
    const netStr = invoice.netAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const subject = `Invoice — ${invoice.subcontractor} — ${projectName} (${projectNumber}) — Net $${netStr}${invoice.costCode ? ` — CC ${invoice.costCode}` : ''}`;

    const bodyHtml = await buildBrandedEmailHtml({
      companyId: invoice.project?.companyId,
      headerTitle: 'Sub Invoice for Accounting',
      body: `
        <p style="margin:0 0 14px">Approved sub invoice ready for payment processing.</p>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 16px 4px 0;color:#666">Subcontractor</td><td style="padding:4px 0;font-weight:600">${invoice.subcontractor}</td></tr>
          ${invoice.invoiceNumber ? `<tr><td style="padding:4px 16px 4px 0;color:#666">Invoice #</td><td style="padding:4px 0">${invoice.invoiceNumber}</td></tr>` : ''}
          <tr><td style="padding:4px 16px 4px 0;color:#666">Project</td><td style="padding:4px 0">${projectName} (${projectNumber})</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#666">Gross amount</td><td style="padding:4px 0">$${invoice.grossAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#666">Net approved</td><td style="padding:4px 0;font-weight:700;color:#2E7D32">$${netStr}</td></tr>
          ${invoice.costCode ? `<tr><td style="padding:4px 16px 4px 0;color:#666">Cost code</td><td style="padding:4px 0;font-weight:600">${invoice.costCode}${invoice.costCodeLabel ? ` — ${invoice.costCodeLabel}` : ''}</td></tr>` : ''}
          ${note ? `<tr><td style="padding:4px 16px 4px 0;color:#666">Note</td><td style="padding:4px 0">${note}</td></tr>` : ''}
        </table>
        <p style="margin:14px 0 0;color:#666;font-size:13px">The stamped PDF (with cost code and net amount marked in red) is attached.</p>
      `,
    });

    // Adjuntar el PDF sellado
    const pdfBuffer = await downloadFileBuffer(pdfPath);
    const filename = invoice.stampedFileName ?? invoice.fileName ?? `invoice-${invoice.id}.pdf`;

    const result = await sendEmail({
      to,
      cc,
      subject,
      html: bodyHtml,
      attachments: [{ filename, content: pdfBuffer.toString('base64') }],
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Email failed' }, { status: 500 });
    }

    const updated = await prisma.subInvoice.update({
      where: { id: invoice.id },
      data: { status: 'Sent', sentToEmail: to, sentAt: new Date() },
    });

    return NextResponse.json({ ok: true, invoice: updated });
  } catch (err) {
    console.error('sub-invoices send-accounting error:', err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
