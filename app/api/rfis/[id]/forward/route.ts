export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import { appBaseUrl } from '@/lib/app-url';
import { getPdfBrand } from '@/lib/company-brand';
import { buildRfiPdfHtml, mergeRfiPdfWithAttachments, RfiPdfMergeError } from '@/lib/rfi-pdf';
import { getSessionLocale } from '@/lib/i18n/server';
import { sendEmail } from '@/lib/email';

function escHtml(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';
    const senderName = (session.user as any)?.name ?? 'Kodu PM';
    const senderEmail = (session.user as any)?.email ?? '';

    const body = await request.json();
    const rawEmails = body?.emails;
    const message = String(body?.message ?? '').trim();

    if (!rawEmails || !Array.isArray(rawEmails) || rawEmails.length === 0) {
      return NextResponse.json({ error: 'At least one email is required' }, { status: 400 });
    }

    // Validate emails
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = rawEmails
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => EMAIL_RE.test(e));

    if (emails.length === 0) {
      return NextResponse.json({ error: 'No valid emails provided' }, { status: 400 });
    }

    const rfi = await prisma.rFI.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
      include: { project: true, attachments: true },
    });

    if (!rfi) {
      return NextResponse.json({ error: 'RFI not found' }, { status: 404 });
    }

    // Generate PDF
    const brand = await getPdfBrand(companyId, appBaseUrl(), 44);
    const locale = await getSessionLocale();
    const htmlContent = buildRfiPdfHtml(rfi, rfi.project, brand, locale);
    const pdfBuffer = await htmlToPdf(htmlContent);

    let finalPdfBytes: Uint8Array;
    try {
      finalPdfBytes = await mergeRfiPdfWithAttachments(pdfBuffer, rfi.attachments ?? []);
    } catch (err) {
      if (err instanceof RfiPdfMergeError) {
        return NextResponse.json(
          { error: err.message, failedFiles: err.failedFiles },
          { status: 500 },
        );
      }
      throw err;
    }

    // Convert PDF to base64 for attachment
    const pdfBase64 = Buffer.from(finalPdfBytes).toString('base64');
    const pdfFilename = `RFI_${rfi.rfiNumber}_${(rfi.subject || '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.pdf`;

    // Build email HTML
    const link = `${appBaseUrl()}/dashboard/rfis/${rfi.id}`;
    const emailBody = `
      <p><strong>RFI ${escHtml(rfi.rfiNumber)}</strong> — ${escHtml(rfi.project.projectName ?? '')}</p>
      <p><strong>Subject:</strong> ${escHtml(rfi.subject ?? '')}</p>
      <p><strong>Assigned To:</strong> ${escHtml(rfi.assignedTo ?? '—')}</p>
      <p><strong>Status:</strong> ${escHtml(rfi.status ?? 'Open')}</p>
      ${message ? `<div style="background:white;padding:15px;border-radius:4px;border-left:4px solid #C9A96E;margin:12px 0;"><p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;">Message from ${escHtml(senderName)}</p><p style="margin:4px 0 0 0;">${escHtml(message).replace(/\n/g, '<br/>')}</p></div>` : ''}
      <p>The RFI PDF is attached. You can also <a href="${link}" style="color:#C9A96E;font-weight:600;">view it in koduPM</a>.</p>
      <p style="margin-top:12px;font-size:12px;color:#666;">Sent by ${escHtml(senderName)}${senderEmail ? ` (${escHtml(senderEmail)})` : ''}</p>
    `;

    const brandForEmail = await getPdfBrand(companyId, appBaseUrl(), 40);
    const logoBlock = process.env.EMAIL_LOGO_URL?.trim()
      ? `<img src="${process.env.EMAIL_LOGO_URL}" alt="${escHtml(brandForEmail.name)}" width="190" style="display:block;margin:0 auto;max-width:190px;height:auto;border:0;" />`
      : brandForEmail.logoHtml;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#0F1B33;padding:18px 20px;border-radius:8px 8px 0 0;text-align:center;">
          ${logoBlock}
        </div>
        <div style="background:#0F1B33;padding:12px 20px;border-top:3px solid #C9A96E;">
          <h2 style="color:#C9A96E;margin:0;font-size:18px;">RFI Forwarded — RFI Reenviado</h2>
        </div>
        <div style="background:#f9fafb;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
          ${emailBody}
          <p style="margin-top:16px;font-size:11px;color:#9ca3af;">${escHtml(brandForEmail.name)} · Kodu PM · <a href="${appBaseUrl()}" style="color:#9ca3af;">app.kodupm.com</a></p>
        </div>
      </div>
    `;

    // Send to all recipients
    const result = await sendEmail({
      to: emails,
      subject: `RFI ${rfi.rfiNumber} — ${(rfi.subject || '').substring(0, 60)}`,
      html,
      attachments: [{
        filename: pdfFilename,
        content: pdfBase64,
      }],
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email', skipped: result.skipped },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      sentTo: emails,
      emailId: result.id,
    });
  } catch (error: any) {
    console.error('RFI forward error:', error);
    return NextResponse.json(
      { error: 'Failed to forward RFI', detail: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
