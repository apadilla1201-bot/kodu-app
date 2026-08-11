export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';

const VALID_ROLES = ['admin', 'pm', 'superintendent', 'owner', 'subcontractor', 'viewer'];

/**
 * PATCH /api/team/role — Owner/Admin cambia el rol de un miembro de SU empresa.
 * Reglas:
 * - Solo admin / owner (no PM: cambiar roles es decisión de dirección).
 * - Nadie puede cambiarse el rol a sí mismo (usa otro admin para eso).
 * - El miembro debe pertenecer a la misma empresa.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const me = session.user as any;
    const myRole = me?.role ?? 'viewer';
    const myId = me?.id ?? '';
    const companyId = me?.companyId ?? '';

    if (!isFullAccess(myRole)) {
      return NextResponse.json({ error: 'Only Owner or Admin can change roles' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = String(body?.userId ?? '');
    const newRole = String(body?.role ?? '');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!VALID_ROLES.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    if (userId === myId) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'User not found in your company' }, { status: 404 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error('Team role error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
