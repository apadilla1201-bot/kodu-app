export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { randomBytes } from 'crypto';

const VALID_TYPES = [
  'conditional_progress',
  'unconditional_progress',
  'conditional_final',
  'unconditional_final',
];

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const payAppId = searchParams.get('payAppId');

    const where: any = { project: { companyId } };
    if (projectId) where.projectId = projectId;
    if (payAppId) where.payApplicationId = payAppId;

    const waivers = await prisma.lienWaiver.findMany({
      where,
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        payApplication: { select: { id: true, applicationNumber: true, periodTo: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(waivers);
  } catch (error: any) {
    console.error('GET /api/lien-waivers error:', error);
    // Si la tabla aún no existe (migración no corrida), no tumbamos la página
    if (String(error?.message ?? '').includes('LienWaiver')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to fetch lien waivers' }, { status: 500 });
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
    if (!isFullAccess(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      projectId, payApplicationId, subcontractor, subEmail,
      waiverType, amount, throughDate, notes,
    } = body ?? {};

    if (!projectId || !subcontractor?.trim()) {
      return NextResponse.json({ error: 'Project and subcontractor are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let payAppId: string | null = null;
    if (payApplicationId) {
      const pa = await prisma.payApplication.findFirst({
        where: { id: String(payApplicationId), projectId },
      });
      if (pa) payAppId = pa.id;
    }

    const waiver = await prisma.lienWaiver.create({
      data: {
        projectId,
        payApplicationId: payAppId,
        subcontractor: String(subcontractor).trim(),
        subEmail: subEmail ? String(subEmail).trim().toLowerCase() : null,
        waiverType: VALID_TYPES.includes(waiverType) ? waiverType : 'conditional_progress',
        amount: Number(amount) || 0,
        throughDate: throughDate ? new Date(throughDate) : null,
        notes: notes ? String(notes) : null,
        externalToken: randomBytes(24).toString('hex'),
        createdByName: (session.user as any)?.name ?? null,
        createdByEmail: (session.user as any)?.email ?? null,
      },
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        payApplication: { select: { id: true, applicationNumber: true, periodTo: true } },
      },
    });

    return NextResponse.json(waiver, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/lien-waivers error:', error);
    if (String(error?.message ?? '').includes('LienWaiver')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create lien waiver' }, { status: 500 });
  }
}
