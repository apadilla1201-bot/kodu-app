export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { sendEmail } from '@/lib/email';
import { appBaseUrl } from '@/lib/app-url';
import { randomBytes } from 'crypto';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const TYPE_LABELS: Record<string, string> = {
  conditional_progress: 'Conditional Waiver — Progress Payment',
  unconditional_progress: 'Unconditional Waiver — Progress Payment',
  conditional_final: 'Conditional Waiver — Final Payment',
  unconditional_final: 'Unconditional Waiver — Final Payment',
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const waiver = await prisma.lienWaiver.findFirst({
      where: { id: params.id, project: { companyId } },
      include: { project: { select: { projectNumber: true, projectName: true } } },
    });
    if (!waiver) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const toEmail = String(body?.email ?? waiver.subEmail ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(toEmail)) {
      return NextResponse.json({ error: 'A valid subcontractor email is required' }, { status: 400 });
    }

    const token = waiver.externalToken ?? randomBytes(24).toString('hex');
    await prisma.lienWaiver.update({
      where: { id: waiver.id },
      data: {
        externalToken: token,
        subEmail: toEmail,
        status: 'Sent',
        sentAt: new Date(),
      },
    });

    const respondUrl = `${appBaseUrl()}/respond/waiver/${token}`;
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    const gcName = company?.name ?? 'Your General Contractor';
    const typeLabel = TYPE_LABELS[waiver.waiverType] ?? waiver.waiverType;
    const amount = waiver.amount > 0
      ? `$${waiver.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';
    const through = waiver.throughDate
      ? new Date(waiver.throughDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';

    const html = `
      <h2 style="margin:0 0 12px;color:#0F1B33;">Lien Waiver Requested</h2>
      <p style="margin:0 0 14px;">Hello${waiver.subcontractor ? ` ${waiver.subcontractor}` : ''},</p>
      <p style="margin:0 0 14px;"><b>${gcName}</b> requests the following lien waiver for project <b>${waiver.project.projectNumber} — ${waiver.project.projectName}</b>:</p>
      <table style="border-collapse:collapse;margin:0 0 16px;font-size:14px;">
        <tr><td style="padding:4px 14px 4px 0;color:#666;">Type</td><td><b>${typeLabel}</b></td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#666;">Amount</td><td><b>${amount}</b></td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#666;">Through date</td><td>${through}</td></tr>
      </table>
      <p style="margin:0 0 6px;">Use the secure link below to download the waiver form, sign it, and upload the signed copy:</p>
      <p style="margin:18px 0;"><a href="${respondUrl}" style="background:#0F1B33;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Secure Waiver Link — Abrir Enlace Seguro</a></p><p style="margin-top:14px;font-size:11px;color:#9ca3af;">¿Prefieres español? Abre el enlace y toca «ES» arriba. / Prefer English? Open the link and tap «EN» at the top.</p>
      <p style="margin:0;color:#666;font-size:13px;">No account needed — this link gives access to this waiver only.</p>
    `;

    const result = await sendEmail({
      to: toEmail,
      subject: `Lien Waiver requested — ${waiver.project.projectNumber} ${waiver.project.projectName} (${typeLabel})`,
      html,
    });

    const creatorEmail = (session.user as any)?.email as string | undefined;
    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `✓ Lien waiver request sent to ${toEmail} — ${waiver.project.projectNumber}`,
        html: `<p>Your lien waiver request (<b>${typeLabel}</b>, ${amount}) for <b>${waiver.subcontractor}</b> on project <b>${waiver.project.projectNumber} — ${waiver.project.projectName}</b> was sent to <b>${toEmail}</b>.</p><p>You will be notified when the signed waiver is uploaded.</p>`,
      });
    }

    return NextResponse.json({ ok: true, sentTo: toEmail, emailed: result.ok });
  } catch (error: any) {
    console.error('POST /api/lien-waivers/[id]/send-request error:', error);
    return NextResponse.json({ error: 'Failed to send waiver request' }, { status: 500 });
  }
}
