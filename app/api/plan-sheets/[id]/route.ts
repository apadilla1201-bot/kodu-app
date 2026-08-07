export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, disciplineFromSheet } from '@/lib/plan-room';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sheet = await prisma.planSheet.findFirst({ where: { id: params?.id ?? '', project: { companyId: ctx.companyId } } });
    if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: any = {};
    if (body?.title !== undefined) data.title = String(body.title).trim() || sheet.title;
    if (body?.sheetNumber !== undefined) {
      const num = String(body.sheetNumber).trim().toUpperCase();
      if (num && num !== sheet.sheetNumber) {
        const dup = await prisma.planSheet.findFirst({ where: { projectId: sheet.projectId, sheetNumber: num } });
        if (dup) return NextResponse.json({ error: 'sheet_exists' }, { status: 409 });
        data.sheetNumber = num;
        data.discipline = disciplineFromSheet(num);
      }
    }
    if (body?.discipline !== undefined) data.discipline = body.discipline?.trim() || null;
    if (body?.planSetId !== undefined) data.planSetId = body.planSetId || null;
    if (body?.notes !== undefined) data.notes = body.notes?.trim() || null;

    const updated = await prisma.planSheet.update({ where: { id: sheet.id }, data, include: { revisions: { orderBy: { createdAt: 'desc' } } } });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/plan-sheets/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update plan sheet' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sheet = await prisma.planSheet.findFirst({ where: { id: params?.id ?? '', project: { companyId: ctx.companyId } } });
    if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.planSheet.delete({ where: { id: sheet.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /api/plan-sheets/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete plan sheet' }, { status: 500 });
  }
}
