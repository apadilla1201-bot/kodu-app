export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';
    const projects = await prisma.project.findMany({
      where: { companyId },
      include: {
        changeOrders: { select: { id: true, status: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(projects ?? []);
  } catch (error: any) {
    console.error('GET projects error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any)?.id ?? '';
    const companyId = (session.user as any)?.companyId ?? '';
    const body = await request.json();
    const { projectNumber, projectName, client, location, contractAmount, startDate } = body ?? {};

    if (!projectNumber || !projectName || !client) {
      return NextResponse.json({ error: 'Project number, name, and client are required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        projectNumber: String(projectNumber ?? ''),
        projectName: String(projectName ?? ''),
        client: String(client ?? ''),
        location: location ? String(location) : null,
        contractAmount: parseFloat(String(contractAmount ?? '0')) || 0,
        startDate: startDate ? new Date(startDate) : null,
        userId,
        companyId,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    console.error('POST project error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
