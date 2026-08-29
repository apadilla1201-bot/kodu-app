export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Registered users (ProjectMember)
    const members = await prisma.projectMember.findMany({
      where: { projectId: params.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { role: 'asc' },
    });

    // External contacts (ProjectContact)
    const contacts = await prisma.projectContact.findMany({
      where: { projectId: params.id, isActive: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    // Pending invites for this project
    const invites = await prisma.userInvite.findMany({
      where: { projectId: params.id, companyId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ members, contacts, invites });
  } catch (error: any) {
    console.error('GET team error:', error);
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 });
  }
}
