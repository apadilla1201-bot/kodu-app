export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { collectEmails, resolveEmailAddress, sendItemSentConfirmationEmail } from '@/lib/email';
import { sendEmail } from '@/lib/email';
import { appBaseUrl } from '@/lib/app-url';
import { randomBytes } from 'crypto';

// Envía el RFI al Owner / Owner's Rep para su aprobación, con enlace seguro
// (magic link) — si no tiene cuenta solo ve ESTE RFI y responde desde ahí.
// Si el correo ya es usuario de la empresa, el correo incluye además el botón
// para abrirlo en la app con sus credenciales.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json().catch(() => ({}));
    const toEmail = resolveEmailAddress(body?.email);
    const toName = body?.name ? String(body.name).trim() : '';

    if (!toEmail) {
      return NextResponse.json({ error: 'A valid approver email is required' }, { status: 400 });
    }

    const rfi = await prisma.rFI.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
      include: { project: true },
    });
    if (!rfi) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Magic link (se crea si no existe)
    const token = rfi.externalToken ?? randomBytes(24).toString('hex');
    await prisma.rFI.update({
      where: { id: rfi.id },
      data: {
        externalToken: token,
        status: rfi.status === 'Open' ? 'Under Review' : rfi.status,
        ...(toName ? { assignedTo: toName } : {}),
        assignedToEmail: toEmail,
      },
    });

    // ¿El aprobador ya tiene cuenta en ESTA empresa? → botón "ver con mi cuenta"
    const existingUser = await prisma.user.findFirst({
      where: { email: toEmail, companyId },
      select: { id: true },
    });

    const respondUrl = `${appBaseUrl()}/respond/rfi/${token}`;
    const appUrl = `${appBaseUrl()}/dashboard/rfis/${rfi.id}`;
    const projectName = rfi.project?.projectName ?? '';
    const projectNumber = rfi.project?.projectNumber ?? '';

    const accountBtn = existingUser
      ? `<p style="margin:18px 0 0;"><a href="${appUrl}" style="background:#fff;color:#0F1B33;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;display:inline-block;border:2px solid #C9A96E;">Open in my koduPM account</a></p>
         <p style="color:rgba(255,255,255,0.65);font-size:12px;margin-top:8px;">You already have a koduPM account — sign in to view it with your permissions.</p>`
      : `<p style="color:rgba(255,255,255,0.65);font-size:12px;margin-top:12px;">No account needed — the secure link above lets you view and respond to <strong>this RFI only</strong>.</p>`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;">
        <div style="background:#0F1B33;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <p style="color:#C9A96E;font-size:20px;font-weight:800;margin:0;">koduPM</p>
          <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:6px 0 0;">RFI Approval Request — ${rfi.rfiNumber}</p>
        </div>
        <div style="background:#ffffff;padding:24px;border:1px solid #E5E7EB;">
          <p style="margin:0 0 4px;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${projectNumber} — ${projectName}</p>
          <h2 style="margin:4px 0 12px;color:#0F1B33;font-size:18px;">${rfi.subject}</h2>
          <div style="background:#F7F6F2;border-left:4px solid #C9A96E;padding:12px 16px;border-radius:6px;">
            <p style="margin:0;color:#374151;font-size:14px;white-space:pre-wrap;">${rfi.question}</p>
          </div>
          ${toName ? `<p style="color:#6B7280;font-size:13px;margin-top:14px;">Assigned to: <strong>${toName}</strong></p>` : ''}
        </div>
        <div style="background:#0F1B33;padding:24px;border-radius:0 0 12px 12px;text-align:center;">
          <a href="${respondUrl}" style="background:#C9A96E;color:#0F1B33;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:800;display:inline-block;font-size:15px;">Review &amp; Respond (secure link)</a>
          ${accountBtn}
        </div>
      </div>`;

    const creatorEmail = resolveEmailAddress(session.user?.email);
    await sendEmail({
      to: toEmail,
      cc: creatorEmail ? [creatorEmail] : undefined,
      replyTo: creatorEmail || undefined,
      subject: `RFI ${rfi.rfiNumber} — Approval requested · ${projectNumber} ${projectName}`,
      html,
    });

    // Confirmación al creador
    try {
      if (creatorEmail) {
        await sendItemSentConfirmationEmail({
          companyId: rfi.project.companyId,
          to: [creatorEmail],
          kind: 'RFI',
          number: rfi.rfiNumber,
          title: rfi.subject,
          projectName,
          assignedTo: toName || toEmail,
          itemUrl: appUrl,
        });
      }
    } catch { /* no crítico */ }

    return NextResponse.json({ ok: true, sentTo: toEmail, hasAccount: !!existingUser });
  } catch (error: any) {
    console.error('POST /api/rfis/[id]/send-approval error:', error);
    return NextResponse.json({ error: 'Failed to send RFI for approval' }, { status: 500 });
  }
}
