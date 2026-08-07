export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext } from '@/lib/plan-room';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const set = await prisma.planSet.findFirst({ where: { id: params?.id ?? '', project: { companyId: ctx.companyId } } });
    if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: any = {};
    if (body?.name !== undefined) data.name = String(body.name).trim() || set.name;
    if (body?.setType !== undefined) data.setType = String(body.setType).trim() || set.setType;
    if (body?.issueDate !== undefined) data.issueDate = body.issueDate ? new Date(body.issueDate) : null;
    if (body?.notes !== undefined) data.notes = body.notes?.trim() || null;

    const updated = await prisma.planSet.update({ where: { id: set.id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/plan-sets/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update plan set' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const set = await prisma.planSet.findFirst({ where: { id: params?.id ?? '', project: { companyId: ctx.companyId } } });
    if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Los planos del paquete quedan huérfanos (SetNull), no se borran
    await prisma.planSet.delete({ where: { id: set.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /api/plan-sets/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete plan set' }, { status: 500 });
  }
}
