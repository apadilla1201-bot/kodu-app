export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';
    const myRole = (session.user as any)?.role ?? 'viewer';

    if (!isFullAccess(myRole)) {
      return NextResponse.json({ error: 'Only Admin or PM can assign team members' }, { status: 403 });
    }

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const role = String(body?.role || 'viewer').trim();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email, companyId },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found in your company. Send an invite instead.' }, { status: 404 });
    }

    // Check if already a member
    const existing = await prisma.projectMember.findFirst({
      where: { userId: user.id, projectId: params.id },
    });
    if (existing) {
      return NextResponse.json({ error: 'User is already a member of this project' }, { status: 409 });
    }

    const member = await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId: params.id,
        role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    console.error('POST members error:', error);
    return NextResponse.json({ error: 'Failed to assign member' }, { status: 500 });
  }
}

// List company users NOT already members of this project (for dropdown)
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const existingMemberIds = await prisma.projectMember.findMany({
      where: { projectId: params.id },
      select: { userId: true },
    });
    const ids = existingMemberIds.map((m) => m.userId);

    const users = await prisma.user.findMany({
      where: { companyId, id: { notIn: ids.length ? ids : [''] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('GET members error:', error);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
