export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { randomBytes } from 'crypto';

function guard(role: string): boolean {
  return isFullAccess(role) || role === 'superintendent';
}

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

    const items = await prisma.closeoutItem.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error('GET /api/closeout-items error:', error);
    if (String(error?.message ?? '').includes('CloseoutItem')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to fetch closeout items' }, { status: 500 });
  }
}

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
    const { projectId, category, deliverable, responsible, notes } = body ?? {};
    if (!projectId || !category?.trim() || !deliverable?.trim()) {
      return NextResponse.json({ error: 'Project, category and deliverable are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const last = await prisma.closeoutItem.findFirst({
      where: { projectId },
      orderBy: { sortOrder: 'desc' },
    });

    const item = await prisma.closeoutItem.create({
      data: {
        projectId,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        category: String(category).trim(),
        deliverable: String(deliverable).trim(),
        responsible: responsible ? String(responsible) : null,
        notes: notes ? String(notes) : null,
        externalToken: randomBytes(24).toString('hex'),
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/closeout-items error:', error);
    if (String(error?.message ?? '').includes('CloseoutItem')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create closeout item' }, { status: 500 });
  }
}
