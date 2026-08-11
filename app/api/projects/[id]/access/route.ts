export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { grantProjectAccess, canAccessProject } from '@/lib/project-access';

/**
 * POST /api/projects/[id]/access — desbloquear un proyecto con su clave.
 * Body: { key: string }
 * - Gestión (admin/owner/pm) ya tiene acceso: devuelve ok sin pedir clave.
 * - Si el proyecto NO tiene clave configurada: se deja pasar (proyecto abierto).
 * - Clave correcta → se guarda el desbloqueo (ProjectAccess) y no se vuelve a pedir.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const u = session.user as any;
    const userId = u?.id ?? '';
    const companyId = u?.companyId ?? '';
    const role = u?.role ?? 'viewer';

    const project = await prisma.project.findFirst({
      where: { id: params?.id ?? '', companyId },
      select: { id: true, accessKey: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Gestión entra directo
    if (isFullAccess(role) || (await canAccessProject(userId, project.id, role))) {
      return NextResponse.json({ ok: true, already: true });
    }

    // Proyecto sin clave configurada → SOLO gestión entra (ya filtrado arriba).
    // Superintendent/viewer necesitan que el admin ponga una clave o los invite.
    if (!project.accessKey) {
      return NextResponse.json({ error: 'This project has no access key configured', needsKey: false, noKey: true }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    if (!key) {
      return NextResponse.json({ error: 'Key required', needsKey: true }, { status: 400 });
    }
    if (key !== project.accessKey) {
      return NextResponse.json({ error: 'Wrong key', needsKey: true }, { status: 403 });
    }

    await grantProjectAccess(userId, project.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Project access error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
