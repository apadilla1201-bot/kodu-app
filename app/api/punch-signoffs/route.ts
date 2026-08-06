export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';

function guard(role: string): boolean {
  return isFullAccess(role) || role === 'superintendent';
}

// GET ?projectId= → firmas del proyecto + progreso por área
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!guard(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [signoffs, items] = await Promise.all([
      prisma.punchAreaSignoff.findMany({
        where: { projectId },
        orderBy: { area: 'asc' },
      }),
      prisma.punchItem.findMany({
        where: { projectId },
        select: { area: true, status: true },
      }),
    ]);

    // Progreso por área (para saber cuáles están listas para firmar)
    const progress: Record<string, { total: number; closed: number }> = {};
    for (const it of items) {
      const a = it.area || 'General / No area';
      if (!progress[a]) progress[a] = { total: 0, closed: 0 };
      progress[a].total++;
      if (it.status === 'Completed') progress[a].closed++;
    }

    return NextResponse.json({ signoffs, progress });
  } catch (error: any) {
    console.error('GET /api/punch-signoffs error:', error);
    if (String(error?.message ?? '').includes('PunchAreaSignoff')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to fetch signoffs' }, { status: 500 });
  }
}

// POST { projectId, area, superName, pmName, ownerRepName, remarks }
// Solo permite firmar si el área está 100% Completed (regla del Excel PDG)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!guard(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { projectId, area, superName, pmName, ownerRepName, remarks } = body ?? {};
    if (!projectId || !area) {
      return NextResponse.json({ error: 'projectId and area are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Regla: solo se firma un área 100% cerrada
    const items = await prisma.punchItem.findMany({
      where: { projectId, area: String(area) },
      select: { status: true },
    });
    const notClosed = items.filter((i) => i.status !== 'Completed').length;
    if (items.length === 0) {
      return NextResponse.json({ error: 'Area has no punch items' }, { status: 400 });
    }
    if (notClosed > 0) {
      return NextResponse.json(
        { error: `area_not_complete`, openItems: notClosed },
        { status: 409 },
      );
    }

    const signoff = await prisma.punchAreaSignoff.upsert({
      where: { projectId_area: { projectId, area: String(area) } },
      create: {
        projectId,
        area: String(area),
        superName: superName ? String(superName) : null,
        pmName: pmName ? String(pmName) : null,
        ownerRepName: ownerRepName ? String(ownerRepName) : null,
        remarks: remarks ? String(remarks) : null,
        signedByName: (session.user as any)?.name ?? null,
        signedByEmail: (session.user as any)?.email ?? null,
      },
      update: {
        superName: superName ? String(superName) : null,
        pmName: pmName ? String(pmName) : null,
        ownerRepName: ownerRepName ? String(ownerRepName) : null,
        remarks: remarks ? String(remarks) : null,
        signedByName: (session.user as any)?.name ?? null,
        signedByEmail: (session.user as any)?.email ?? null,
        signedAt: new Date(),
      },
    });

    return NextResponse.json(signoff, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/punch-signoffs error:', error);
    if (String(error?.message ?? '').includes('PunchAreaSignoff')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to sign area' }, { status: 500 });
  }
}

// DELETE { projectId, area } — deshace la firma (si se reabrió un ítem del área)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!guard(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { projectId, area } = body ?? {};
    if (!projectId || !area) {
      return NextResponse.json({ error: 'projectId and area are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await prisma.punchAreaSignoff.deleteMany({
      where: { projectId, area: String(area) },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /api/punch-signoffs error:', error);
    return NextResponse.json({ error: 'Failed to remove signoff' }, { status: 500 });
  }
}
