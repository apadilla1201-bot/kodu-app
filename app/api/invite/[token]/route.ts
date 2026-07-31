export const dynamic = 'force-dynamic';

// ============================================================
// PASO 3 — Aceptar invitación: ver datos (GET) y crear clave (POST)
// El invitado queda DENTRO de la empresa del invitador con su rol.
// ============================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { ROLE_LABELS } from '@/lib/permissions';

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const invite = await prisma.userInvite.findFirst({
      where: { token: params?.token ?? '', status: 'pending' },
      include: {
        company: { select: { name: true } },
        project: { select: { projectName: true, projectNumber: true } },
      },
    });

    if (!invite || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    return NextResponse.json({
      email: invite.email,
      name: invite.name,
      role: invite.role,
      roleLabel: ROLE_LABELS[invite.role] ?? invite.role,
      companyName: invite.company.name,
      projectName: invite.project?.projectName ?? null,
    });
  } catch (error: any) {
    console.error('GET /api/invite/[token] error:', error);
    return NextResponse.json({ error: 'Failed to load invitation' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const invite = await prisma.userInvite.findFirst({
      where: { token: params?.token ?? '', status: 'pending' },
    });

    if (!invite || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    const body = await request.json();
    const { password, name } = body ?? {};

    if (!password || String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // ¿El correo ya existe como usuario? No debe pasar (el invite solo se crea para nuevos),
    // pero por seguridad lo rechazamos con mensaje claro.
    const existing = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      return NextResponse.json({ error: 'This email already has an account. Please log in.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(String(password), 12);
    const displayName = name?.trim() ? String(name) : invite.name ?? invite.email.split('@')[0];

    const user = await prisma.user.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        name: displayName,
        role: invite.role,
        companyId: invite.companyId, // ← se une a la empresa del invitador (NO crea tenant)
      },
    });

    // Membresía (con proyecto si el rol es owner/subcontractor)
    await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId: invite.projectId,
        role: invite.role,
      },
    });

    await prisma.userInvite.update({
      where: { id: invite.id },
      data: { status: 'accepted' },
    });

    return NextResponse.json({ ok: true, email: user.email }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/invite/[token] error:', error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
