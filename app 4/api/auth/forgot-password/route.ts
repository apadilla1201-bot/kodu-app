export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { createResetToken } from '@/lib/password-reset';
import { sendEmail } from '@/lib/email';
import { appBaseUrl } from '@/lib/app-url';

// Best-effort rate limit: one reset email per address per minute per instance.
// (Serverless instances are ephemeral; this throttles casual abuse only.)
const lastSent = new Map<string, number>();

function resetEmailHtml(name: string, url: string, locale: string): { subject: string; html: string } {
  const es = locale === 'es';
  const subject = es
    ? 'Restablecer tu contraseña — Kodu PM'
    : 'Reset your password — Kodu PM';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0F1B33;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h2 style="color:#C9A96E;margin:0;font-size:18px;">${es ? 'Restablecer contraseña' : 'Reset your password'}</h2>
      </div>
      <div style="background:#f9fafb;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
        <p>${es ? `Hola${name ? ` ${name}` : ''},` : `Hi${name ? ` ${name}` : ''},`}</p>
        <p>${es
          ? 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz click en el botón para crear una nueva:'
          : 'We received a request to reset your account password. Click the button to choose a new one:'}</p>
        <p style="margin:20px 0;">
          <a href="${url}" style="display:inline-block;background:#C9A96E;color:#0F1B33;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            ${es ? 'Restablecer contraseña' : 'Reset password'}
          </a>
        </p>
        <p style="color:#666;font-size:13px;">${es
          ? 'Este enlace vence en 30 minutos y solo puede usarse una vez. Si no solicitaste este cambio, ignora este correo — tu contraseña no cambiará.'
          : "This link expires in 30 minutes and can only be used once. If you didn't request this, ignore this email — your password won't change."}</p>
        <p style="color:#9ca3af;font-size:11px;word-break:break-all;">${url}</p>
        <p style="margin-top:16px;font-size:11px;color:#9ca3af;">The Project Delivery Group LLC · Kodu PM</p>
      </div>
    </div>
  `;
  return { subject, html };
}

// Correo de invitación reenviada (mismo diseño que la invitación original)
function inviteEmailHtml(name: string, companyName: string, projectName: string | null, url: string, locale: string): { subject: string; html: string } {
  const es = locale === 'es';
  const subject = es
    ? `Tu invitación a Kodu PM — ${companyName}`
    : `You've been invited to Kodu PM — ${companyName}`;
  const NAVY = '#0F1B33';
  const GOLD = '#C9A96E';
  const logo = `${appBaseUrl()}/pdg_logo.png`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:${NAVY};padding:18px 20px;border-radius:8px 8px 0 0;text-align:center;">
        <img src="${logo}" alt="${companyName}" width="190" style="display:block;margin:0 auto;max-width:190px;height:auto;border:0;" />
      </div>
      <div style="background:${NAVY};padding:12px 20px;border-top:3px solid ${GOLD};">
        <h2 style="color:${GOLD};margin:0;font-size:18px;">${es ? 'Invitación al proyecto' : 'Project Invitation'}</h2>
      </div>
      <div style="background:#f9fafb;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
        <p>${es ? `Hola${name ? ` ${name}` : ''},` : `Hi${name ? ` ${name}` : ''},`}</p>
        <p>${es
          ? `Aún no has activado tu cuenta en <strong>Kodu PM</strong>${projectName ? ` — proyecto <strong>${projectName}</strong>` : ''}. Pediste restablecer tu contraseña, pero primero debes crearla desde este enlace de invitación:`
          : `Your Kodu PM account${projectName ? ` — project <strong>${projectName}</strong>` : ''} isn't activated yet. You asked for a password reset, but you first need to create your password from this invitation link:`}</p>
        <p style="margin:20px 0;">
          <a href="${url}" style="display:inline-block;background:${GOLD};color:${NAVY};padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;">
            ${es ? 'Aceptar invitación y crear contraseña' : 'Accept Invitation & Create Password'}
          </a>
        </p>
        <p style="color:#666;font-size:13px;">${es
          ? 'Este enlace es único y vence en 7 días.'
          : 'This link is unique and expires in 7 days.'}</p>
        <p style="margin-top:16px;font-size:11px;color:#9ca3af;">The Project Delivery Group LLC · Kodu PM</p>
      </div>
    </div>
  `;
  return { subject, html };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    // Always return the same response so the endpoint can't be used to
    // enumerate registered emails.
    const genericOk = NextResponse.json({
      success: true,
      message: 'If an account exists for this email, a reset link is on its way.',
    });

    const now = Date.now();
    const last = lastSent.get(email) ?? 0;
    if (now - last < 60_000) return genericOk;

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.password) {
      // Flujo normal: cuenta existe → correo de reset
      const token = createResetToken({ id: user.id, email: user.email, password: user.password });
      const url = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

      const { subject, html } = resetEmailHtml(user.name ?? '', url, user.locale || 'en');
      const result = await sendEmail({ to: user.email, subject, html });
      lastSent.set(email, now);
      if (!result.ok) {
        const why = result.error ?? (result.skipped ? 'skipped-no-api-key' : 'unknown');
        console.warn(`[forgot-password] Email not sent (${why}). Link for ${email}: ${url}`);
      }
      return genericOk;
    }

    // Cuenta NO existe: si hay una invitación pendiente para este correo,
    // reenviar la invitación con token nuevo (7 días) en vez de quedarse callado.
    // Caso real: el invitado pide "forgot password" sin haber aceptado nunca.
    if (!user) {
      const invite = await prisma.userInvite.findFirst({
        where: { email, status: 'pending' },
        include: { project: { select: { projectName: true } }, company: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      if (invite) {
        const newToken = randomBytes(24).toString('hex');
        const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma.userInvite.update({
          where: { id: invite.id },
          data: { token: newToken, expiresAt: newExpiry },
        });
        const url = `${appBaseUrl()}/accept-invite/${newToken}`;
        const { subject, html } = inviteEmailHtml(
          invite.name ?? '',
          invite.company?.name ?? 'Kodu PM',
          invite.project?.projectName ?? null,
          url,
          'en',
        );
        const result = await sendEmail({ to: email, subject, html });
        lastSent.set(email, now);
        if (!result.ok) {
          const why = result.error ?? (result.skipped ? 'skipped-no-api-key' : 'unknown');
          console.warn(`[forgot-password] Invite resend not sent (${why}). Link for ${email}: ${url}`);
        }
      }
    }

    return genericOk;
  } catch (err: any) {
    console.error('[forgot-password] Error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
