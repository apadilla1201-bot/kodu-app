export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id ?? '';
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const where: any = { project: { userId } };
    if (projectId) where.projectId = projectId;

    const payApps = await prisma.payApplication.findMany({
      where,
      include: { project: { select: { id: true, projectNumber: true, projectName: true, client: true } }, lineItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { applicationNumber: 'desc' },
    });

    return NextResponse.json(payApps);
  } catch (error: any) {
    console.error('GET /api/pay-apps error:', error);
    return NextResponse.json({ error: 'Failed to fetch pay applications' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id ?? '';
    const body = await request.json();
    const { projectId, ...data } = body;

    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Remove non-model fields that may come from import
    delete data.projectName;
    delete data.projectNumber;
    delete data.gcCompany;
    delete data.opAmount;
    delete data.contingencyAmount;
    delete data.netChangeByOrders;
    delete data.applicationNumber_;
    delete data.retainageContPercent;

    const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Get next application number
    const lastPA = await prisma.payApplication.findFirst({
      where: { projectId },
      orderBy: { applicationNumber: 'desc' },
    });
    const nextNum = (lastPA?.applicationNumber ?? 0) + 1;

    const lineItems = data.lineItems ?? [];
    delete data.lineItems;

    const payApp = await prisma.payApplication.create({
      data: {
        ...data,
        projectId,
        applicationNumber: data.applicationNumber ?? nextNum,
        applicationDate: new Date(data.applicationDate ?? new Date()),
        periodFrom: new Date(data.periodFrom ?? new Date()),
        periodTo: new Date(data.periodTo ?? new Date()),
        contractDate: data.contractDate ? new Date(data.contractDate) : null,
        lineItems: {
          create: lineItems.map((li: any, i: number) => ({
            sortOrder: li.sortOrder ?? i + 1,
            itemNumber: String(li.itemNumber ?? ''),
            sectionCode: String(li.sectionCode ?? ''),
            sectionTitle: String(li.sectionTitle ?? ''),
            description: String(li.description ?? ''),
            subVendor: String(li.subVendor ?? ''),
            scheduledValue: Number(li.scheduledValue) || 0,
            budgetRealloc: Number(li.budgetRealloc) || 0,
            previousChanges: Number(li.previousChanges) || 0,
            currentChanges: Number(li.currentChanges) || 0,
            previousCompleted: Number(li.previousCompleted) || 0,
            thisCompleted: Number(li.thisCompleted) || 0,
            retainage: Number(li.retainage) || 0,
            isSection: li.isSection === true,
            isBelowLine: li.isBelowLine === true,
            isFee: li.isFee === true,
          })),
        },
      },
      include: { project: true, lineItems: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json(payApp, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/pay-apps error:', error);
    return NextResponse.json({ error: 'Failed to create pay application' }, { status: 500 });
  }
}
