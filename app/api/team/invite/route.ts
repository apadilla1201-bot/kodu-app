export const dynamic = 'force-dynamic';

// ============================================================
// PASO 3 — Invitar miembros al equipo (admin / pm solamente)
// El invitado recibe un correo con enlace para crear su clave
// y queda DENTRO de la empresa del invitador (nunca crea tenant).
// ============================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { appBaseUrl } from '@/lib/app-url';
import { sendEmail } from '@/lib/email';
import { canInvite, ROLE_LABELS } from '@/lib/permissions';

const VALID_ROLES = ['admin', 'pm', 'superintendent', 'owner', 'subcontractor', 'viewer'];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';

    if (!canInvite(role)) {
      return NextResponse.json({ error: 'Solo el Administrador o el PM pueden invitar miembros' }, { status: 403 });
    }
    if (!companyId) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 400 });
    }

    const body = await request.json();
    const { email, name, role: inviteRole, projectId } = body ?? {};

    if (!email || !String(email).includes('@')) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const finalRole = VALID_ROLES.includes(inviteRole) ? inviteRole : 'viewer';

    // owner del proyecto y subcontractor requieren proyecto asignado
    if ((finalRole === 'owner' || finalRole === 'subcontractor') && !projectId) {
      return NextResponse.json({ error: 'Owner and Subcontractor require a project' }, { status: 400 });
    }

    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: String(projectId), companyId } });
      if (!project) {
        return NextResponse.json({ error: 'Project not found in your company' }, { status: 404 });
      }
    }

    // ¿Ya es usuario? → se le añade la membresía, sin correo de invitación
    const existingUser = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (existingUser) {
      if (existingUser.companyId && existingUser.companyId !== companyId) {
        return NextResponse.json({ error: 'Este correo ya pertenece a otra empresa' }, { status: 409 });
      }
      await prisma.projectMember.upsert({
        where: { userId_projectId: { userId: existingUser.id, projectId: projectId ? String(projectId) : '' } },
        update: { role: finalRole },
        create: { userId: existingUser.id, projectId: projectId ? String(projectId) : null, role: finalRole },
      }).catch(async () => {
        // upsert con projectId null puede fallar por el unique compuesto; fallback manual
        const existing = await prisma.projectMember.findFirst({
          where: { userId: existingUser.id, projectId: projectId ? String(projectId) : null },
        });
        if (existing) {
          await prisma.projectMember.update({ where: { id: existing.id }, data: { role: finalRole } });
        } else {
          await prisma.projectMember.create({
            data: { userId: existingUser.id, projectId: projectId ? String(projectId) : null, role: finalRole },
          });
        }
      });
      // actualiza el rol principal del usuario si no tenía uno fuerte
      if (!isFullAccessRole(existingUser.role)) {
        await prisma.user.update({ where: { id: existingUser.id }, data: { role: finalRole, companyId } });
      }
      return NextResponse.json({ ok: true, added: true, email }, { status: 200 });
    }

    // Usuario nuevo → invitación con token (7 días)
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.userInvite.create({
      data: {
        companyId,
        email: String(email).toLowerCase().trim(),
        name: name ? String(name) : null,
        role: finalRole,
        projectId: projectId ? String(projectId) : null,
        token,
        invitedBy: (session.user as any)?.id ?? null,
        expiresAt,
      },
      include: { project: { select: { projectName: true } }, company: { select: { name: true } } },
    });

    // Correo de invitación con logo (misma plantilla del sistema)
    try {
      const acceptUrl = `${appBaseUrl()}/accept-invite/${token}`;
      const roleLabel = ROLE_LABELS[finalRole] ?? finalRole;
      const NAVY = '#0F1B33';
      const GOLD = '#C9A96E';
      const logo = `${appBaseUrl()}/pdg_logo.png`;
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:${NAVY};padding:18px 20px;border-radius:8px 8px 0 0;text-align:center;">
            <img src="${logo}" alt="The Project Delivery Group LLC" width="190" style="display:block;margin:0 auto;max-width:190px;height:auto;border:0;" />
          </div>
          <div style="background:${NAVY};padding:12px 20px;border-top:3px solid ${GOLD};">
            <h2 style="color:${GOLD};margin:0;font-size:18px;">Project Invitation</h2>
          </div>
          <div style="background:#f9fafb;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
            <p>Hello${invite.name ? ` ${invite.name}` : ''},</p>
            <p><strong>${session.user?.name ?? 'Your GC'}</strong> (${invite.company.name}) has invited you to join
            <strong>Kodu PM</strong>${invite.project ? ` — project <strong>${invite.project.projectName}</strong>` : ''},
            with the role of <strong>${roleLabel}</strong>.</p>
            <p style="font-size:13px;color:#374151;">Click below to create your password and access the project. This link is unique and expires in 7 days.</p>
            <p><a href="${acceptUrl}" style="display:inline-block;background:${GOLD};color:${NAVY};padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:700;">Accept Invitation & Create Password</a></p>
            <p style="margin-top:16px;font-size:11px;color:#9ca3af;">The Project Delivery Group LLC · Kodu PM</p>
          </div>
        </div>
      `;
      await sendEmail({
        to: invite.email,
        subject: `You've been invited to Kodu PM — ${invite.company.name}`,
        html,
      });
    } catch (emailErr) {
      console.error('Invite email error:', emailErr);
    }

    return NextResponse.json({ ok: true, invited: true, email: invite.email }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/team/invite error:', error);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}

function isFullAccessRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'owner' || role === 'pm';
}

// Listar miembros + invitaciones pendientes del equipo
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';
    if (!companyId) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    const users = await prisma.user.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const members = await prisma.projectMember.findMany({
      where: { user: { companyId } },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        project: { select: { id: true, projectName: true, projectNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const invites = await prisma.userInvite.findMany({
      where: { companyId, status: 'pending' },
      include: { project: { select: { id: true, projectName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users, members, invites });
  } catch (error: any) {
    console.error('GET /api/team/invite error:', error);
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 });
  }
}
