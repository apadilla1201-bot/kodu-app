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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role) && role !== 'superintendent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const item = await prisma.closeoutItem.findFirst({
      where: { id: params.id, project: { companyId } },
      include: { project: { select: { projectNumber: true, projectName: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const toEmail = String(body?.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(toEmail)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const token = item.externalToken ?? randomBytes(24).toString('hex');
    await prisma.closeoutItem.update({
      where: { id: item.id },
      data: {
        externalToken: token,
        requestedTo: toEmail,
        requestedAt: new Date(),
        status: item.status === 'Pending' ? 'Requested' : item.status,
      },
    });

    const respondUrl = `${appBaseUrl()}/respond/closeout/${token}`;
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    const gcName = company?.name ?? 'Your General Contractor';

    const html = `
      <h2 style="margin:0 0 12px;color:#0F1B33;">Closeout Document Requested</h2>
      <p style="margin:0 0 14px;">Hello,</p>
      <p style="margin:0 0 14px;"><b>${gcName}</b> requests the following closeout deliverable for project <b>${item.project.projectNumber} — ${item.project.projectName}</b>:</p>
      <table style="border-collapse:collapse;margin:0 0 16px;font-size:14px;">
        <tr><td style="padding:4px 14px 4px 0;color:#666;">Category</td><td>${item.category}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#666;">Deliverable</td><td><b>${item.deliverable}</b></td></tr>
      </table>
      <p style="margin:0 0 6px;">Use the secure link below to upload the document (PDF or photo):</p>
      <p style="margin:18px 0;"><a href="${respondUrl}" style="background:#0F1B33;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">Upload Document — Subir Documento</a></p><p style="margin-top:14px;font-size:11px;color:#9ca3af;">¿Prefieres español? Abre el enlace y toca «ES» arriba. / Prefer English? Open the link and tap «EN» at the top.</p>
      <p style="margin:0;color:#666;font-size:13px;">No account needed — this link gives access to this deliverable only.</p>
    `;

    const result = await sendEmail({
      to: toEmail,
      subject: `Closeout document requested: ${item.deliverable} — ${item.project.projectNumber}`,
      html,
    });

    const creatorEmail = (session.user as any)?.email as string | undefined;
    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `✓ Closeout request sent to ${toEmail} — ${item.project.projectNumber}`,
        html: `<p>Your closeout document request (<b>${item.deliverable}</b>, project <b>${item.project.projectNumber}</b>) was sent to <b>${toEmail}</b>.</p><p>You will be notified when the document is uploaded.</p>`,
      });
    }

    return NextResponse.json({ ok: true, sentTo: toEmail, emailed: result.ok });
  } catch (error: any) {
    console.error('POST /api/closeout-items/[id]/send-request error:', error);
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 });
  }
}
