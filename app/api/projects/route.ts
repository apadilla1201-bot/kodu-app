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
    let companyId = (session.user as any)?.companyId ?? '';
    // FIX: session tokens created before tenant provisioning carry
    // companyId = NULL — fall back to the DB value so the list is
    // not empty after the POST auto-provisions a company.
    if (!companyId) {
      const uid = (session.user as any)?.id ?? '';
      if (uid) {
        const dbUser = await prisma.user.findUnique({
          where: { id: uid },
          select: { companyId: true },
        });
        companyId = dbUser?.companyId ?? '';
      }
    }
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
    let companyId = (session.user as any)?.companyId ?? '';
    const body = await request.json();
    const { projectNumber, projectName, client, location, contractAmount, startDate } = body ?? {};

    if (!projectNumber || !projectName || !client) {
      return NextResponse.json({ error: 'Project number, name, and client are required' }, { status: 400 });
    }

    // FIX P0: resolve the tenant. If the session has no companyId (users
    // created before tenant provisioning existed), look it up in the DB;
    // if the user has no company at all, auto-provision one so project
    // creation never fails with an empty-FK violation again.
    if (!companyId && userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true, name: true, email: true },
      });
      companyId = dbUser?.companyId ?? '';
      if (!companyId) {
        const displayName = dbUser?.name ?? dbUser?.email?.split('@')?.[0] ?? 'User';
        const company = await prisma.company.create({
          data: { name: `${displayName}'s Company` },
        });
        await prisma.user.update({
          where: { id: userId },
          data: { companyId: company.id },
        });
        companyId = company.id;
      }
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
    // Return the Prisma error code (safe) so support can identify the real cause.
    const code = error?.code ? String(error.code) : undefined;
    return NextResponse.json({ error: 'Failed to create project', code }, { status: 500 });
  }
}
