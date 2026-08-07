export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { buildBrandedEmailHtml, sendEmail } from '@/lib/email';
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
    const item = await prisma.punchItem.findFirst({
      where: { id: params.id, project: { companyId } },
      include: { project: { select: { projectNumber: true, projectName: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const toEmail = String(body?.email ?? item.assignedToEmail ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(toEmail)) {
      return NextResponse.json({ error: 'A valid assignee email is required' }, { status: 400 });
    }

    const token = item.externalToken ?? randomBytes(24).toString('hex');
    await prisma.punchItem.update({
      where: { id: item.id },
      data: {
        externalToken: token,
        assignedToEmail: toEmail,
        sentAt: new Date(),
        status: item.status === 'Open' ? 'In Progress' : item.status,
      },
    });

    const respondUrl = `${appBaseUrl()}/respond/punch/${token}`;
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
    const gcName = company?.name ?? 'Your General Contractor';
    const due = item.dueDate
      ? new Date(item.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';

    const html = await buildBrandedEmailHtml({ companyId: companyId, headerTitle: 'Punch List Item Assigned', body: `
      <p style="margin:0 0 14px;">Hello${item.assignedToName ? ` ${item.assignedToName}` : ''},</p>
      <p style="margin:0 0 14px;"><b>${gcName}</b> assigned you punch list item <b>#${item.itemNumber}</b> on project <b>${item.project.projectNumber} — ${item.project.projectName}</b>:</p>
      <table style="border-collapse:collapse;margin:0 0 16px;font-size:14px;">
        <tr><td style="padding:4px 14px 4px 0;color:#666;">Item</td><td><b>${item.title}</b></td></tr>
        ${item.location ? `<tr><td style="padding:4px 14px 4px 0;color:#666;">Location</td><td>${item.location}</td></tr>` : ''}
        ${item.trade ? `<tr><td style="padding:4px 14px 4px 0;color:#666;">Trade</td><td>${item.trade}</td></tr>` : ''}
        <tr><td style="padding:4px 14px 4px 0;color:#666;">Priority</td><td><b>${item.priority}</b>${item.priority === 'A' ? ' — Life Safety / TCO (urgent)' : item.priority === 'B' ? ' — Functional' : ' — Cosmetic'}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#666;">Due date</td><td>${due}</td></tr>
      </table>
      ${item.description ? `<p style="margin:0 0 14px;color:#444;">${item.description}</p>` : ''}
      ${item.correctiveAction ? `<p style="margin:0 0 14px;color:#0F1B33;"><b>Required corrective action:</b> ${item.correctiveAction}</p>` : ''}
      <p style="margin:0 0 6px;">When the work is corrected, use the secure link below to mark it ready and upload a photo:</p>
      <p style="margin:18px 0;"><a href="${respondUrl}" style="background:#0F1B33;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Punch Item — Abrir Ítem de Punch</a></p><p style="margin-top:14px;font-size:11px;color:#9ca3af;">¿Prefieres español? Abre el enlace y toca «ES» arriba. / Prefer English? Open the link and tap «EN» at the top.</p>
      <p style="margin:0;color:#666;font-size:13px;">No account needed — this link gives access to this punch item only.</p>
    ` });

    const result = await sendEmail({
      to: toEmail,
      subject: `Punch item #${item.itemNumber} assigned — ${item.project.projectNumber} ${item.project.projectName}`,
      html,
    });

    const creatorEmail = (session.user as any)?.email as string | undefined;
    if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `✓ Punch item #${item.itemNumber} sent to ${toEmail} — ${item.project.projectNumber}`,
        html: await buildBrandedEmailHtml({ companyId: companyId, headerTitle: '✓ Punch Item Sent', body: `<p>Punch item <b>#${item.itemNumber} — ${item.title}</b> (project <b>${item.project.projectNumber}</b>) was sent to <b>${toEmail}</b>.</p><p>You will be notified when it is marked ready for review.</p>` }),
      });
    }

    return NextResponse.json({ ok: true, sentTo: toEmail, emailed: result.ok });
  } catch (error: any) {
    console.error('POST /api/punch-items/[id]/send-assignment error:', error);
    return NextResponse.json({ error: 'Failed to send assignment' }, { status: 500 });
  }
}
