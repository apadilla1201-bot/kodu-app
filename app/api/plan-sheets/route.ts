export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, disciplineFromSheet } from '@/lib/plan-room';

// GET ?projectId= — árbol completo: sets + planos + revisiones (para Plan Room y selectores)
export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') ?? '';
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId: ctx.companyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const [sets, sheets] = await Promise.all([
      prisma.planSet.findMany({ where: { projectId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      prisma.planSheet.findMany({
        where: { projectId },
        include: { revisions: { orderBy: { createdAt: 'desc' } } },
        orderBy: { sheetNumber: 'asc' },
      }),
    ]);

    return NextResponse.json({ sets, sheets, canUpload: ctx.canUpload });
  } catch (error: any) {
    console.error('GET /api/plan-sheets error:', error);
    if (String(error?.message ?? '').includes('does not exist')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 });
  }
}

// POST — crear plano (con primera revisión opcional). Solo Admin/Owner/PM.
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { projectId, planSetId, sheetNumber, title, discipline, notes, revisionLabel } = body ?? {};
    if (!projectId || !sheetNumber?.trim() || !title?.trim()) {
      return NextResponse.json({ error: 'projectId, sheetNumber and title are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId: ctx.companyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const num = String(sheetNumber).trim().toUpperCase();
    const existing = await prisma.planSheet.findFirst({ where: { projectId, sheetNumber: num } });
    if (existing) return NextResponse.json({ error: 'sheet_exists', sheetId: existing.id }, { status: 409 });

    const sheet = await prisma.planSheet.create({
      data: {
        projectId,
        planSetId: planSetId || null,
        sheetNumber: num,
        title: String(title).trim(),
        discipline: discipline?.trim() || disciplineFromSheet(num),
        notes: notes?.trim() || null,
        revisions: {
          create: {
            label: revisionLabel?.trim() || 'Original',
            isCurrent: true,
            uploadedByName: ctx.userName || null,
            uploadedByEmail: ctx.userEmail || null,
          },
        },
      },
      include: { revisions: true },
    });

    return NextResponse.json(sheet, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/plan-sheets error:', error);
    if (String(error?.message ?? '').includes('does not exist')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create plan sheet' }, { status: 500 });
  }
}
