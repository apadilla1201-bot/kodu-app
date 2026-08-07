export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext } from '@/lib/plan-room';

// GET ?projectId= → lista plana y liviana: id, "A-101 — First Floor Plan (Rev B)"
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

    const sheets = await prisma.planSheet.findMany({
      where: { projectId },
      select: {
        id: true,
        sheetNumber: true,
        title: true,
        discipline: true,
        revisions: { where: { isCurrent: true }, select: { label: true }, take: 1 },
      },
      orderBy: { sheetNumber: 'asc' },
    });

    return NextResponse.json(
      sheets.map((s) => ({
        id: s.id,
        sheetNumber: s.sheetNumber,
        title: s.title,
        discipline: s.discipline,
        currentRevision: s.revisions[0]?.label ?? null,
        display: `${s.sheetNumber} — ${s.title}${s.revisions[0]?.label ? ` (${s.revisions[0].label})` : ''}`,
      }))
    );
  } catch (error: any) {
    console.error('GET /api/plan-sheets/lookup error:', error);
    if (String(error?.message ?? '').includes('does not exist')) {
      // Plan Room aún no migrado → lista vacía (los formularios siguen funcionando con texto libre)
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: 'Failed to load plan lookup' }, { status: 500 });
  }
}
