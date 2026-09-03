export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { sendEmail, resolveEmailAddress } from '@/lib/email';
import { getSessionLocale } from '@/lib/i18n/server';
import { buildSubmittalReportPdf } from '@/lib/submittal-report';

const MAX_EMAIL_BYTES = 20 * 1024 * 1024; // margen seguro para adjuntos base64

// Envía el reporte del submittal (portada koduPM + anexos mergeados)
// como PDF adjunto por correo — mismo patrón que los COR.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json().catch(() => ({}));
    const rawEmails = body?.emails;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = Array.isArray(rawEmails)
      ? rawEmails.map((e: string) => e.trim().toLowerCase()).filter((e: string) => EMAIL_RE.test(e))
      : rawEmails ? [String(rawEmails).trim().toLowerCase()].filter((e: string) => EMAIL_RE.test(e))
      : [];
    if (emails.length === 0) {
      return NextResponse.json({ error: 'At least one valid recipient email is required' }, { status: 400 });
    }

    const locale = await getSessionLocale();
      return NextResponse.json({ error: 'At least one valid recipient email is required' }, { status: 400 });
    }
    const toEmail = resolveEmailAddress(body?.email);
    if (!toEmail) {
      return NextResponse.json({ error: 'A valid recipient email is required' }, { status: 400 });
    }

    const locale = await getSessionLocale();
    const report = await buildSubmittalReportPdf(params?.id ?? '', companyId, locale);
    if (!report) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (report.bytes.length > MAX_EMAIL_BYTES) {
      return NextResponse.json(
        { error: 'too_large', detail: 'Merged PDF is too large to email — download it instead.' },
        { status: 413 }
      );
    }

    const creatorEmail = resolveEmailAddress(session.user?.email);
    const customMessage = typeof body?.message === 'string' ? body.message.trim() : '';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;">
        <div style="background:#0F1B33;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <p style="color:#C9A96E;font-size:20px;font-weight:800;margin:0;">koduPM</p>
          <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:6px 0 0;">Submittal ${report.submittalNumber} — ${report.status}</p>
        </div>
        <div style="background:#ffffff;padding:24px;border:1px solid #E5E7EB;">
          <p style="margin:0 0 4px;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${report.projectNumber} — ${report.projectName}</p>
          <h2 style="margin:4px 0 12px;color:#0F1B33;font-size:18px;">${report.title}</h2>
          ${customMessage ? `<div style="background:#F7F6F2;border-left:4px solid #C9A96E;padding:12px 16px;border-radius:6px;"><p style="margin:0;color:#374151;font-size:14px;white-space:pre-wrap;">${customMessage}</p></div>` : ''}
          <p style="color:#374151;font-size:14px;margin-top:14px;">
            Attached is the submittal report as a single PDF: koduPM cover
            ${report.mergedAttachments > 0 ? `+ <strong>${report.mergedAttachments}</strong> merged attachment(s)` : '(no attachments merged)'}.
          </p>
          ${report.skippedAttachments.length ? `<p style="color:#B45309;font-size:12px;margin-top:8px;">Not mergeable (sent separately on request): ${report.skippedAttachments.join(', ')}</p>` : ''}
        </div>
        <div style="background:#0F1B33;padding:16px;border-radius:0 0 12px 12px;text-align:center;">
          <p style="color:rgba(255,255,255,0.65);font-size:12px;margin:0;">Sent via koduPM — Construction Project Management</p>
        </div>
      </div>`;

    const result = await sendEmail({
      to: emails,
      cc: creatorEmail ? [creatorEmail] : undefined,
      replyTo: creatorEmail || undefined,
      subject: `Submittal ${report.submittalNumber} — ${report.title} · ${report.projectNumber} ${report.projectName}`,
      html,
      attachments: [
        {
          filename: report.fileName,
          content: Buffer.from(report.bytes).toString('base64'),
        },
      ],
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'send_failed' }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      sentTo: emails,
      mergedAttachments: report.mergedAttachments,
      skippedAttachments: report.skippedAttachments,
    });
      to: toEmail,
      cc: creatorEmail ? [creatorEmail] : undefined,
      replyTo: creatorEmail || undefined,
      subject: `Submittal ${report.submittalNumber} — ${report.title} · ${report.projectNumber} ${report.projectName}`,
      html,
      attachments: [
        {
          filename: report.fileName,
          content: Buffer.from(report.bytes).toString('base64'),
        },
      ],
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'send_failed' }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      sentTo: toEmail,
      mergedAttachments: report.mergedAttachments,
      skippedAttachments: report.skippedAttachments,
    });
  } catch (error: any) {
    console.error('POST /api/submittals/[id]/send-report error:', error);
    return NextResponse.json({ error: 'Failed to send submittal report' }, { status: 500 });
  }
}
