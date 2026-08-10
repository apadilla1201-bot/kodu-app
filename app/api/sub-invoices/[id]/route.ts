export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { findCostCode } from '@/lib/cost-codes';

// PATCH → edita datos del invoice (cost code, neto, sub, etc.)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const invoice = await prisma.subInvoice.findFirst({ where: { id: params.id, project: { companyId } } });
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: any = {};
    if (body.subcontractor != null) data.subcontractor = String(body.subcontractor).trim();
    if (body.invoiceNumber !== undefined) data.invoiceNumber = String(body.invoiceNumber ?? '').trim() || null;
    if (body.description !== undefined) data.description = String(body.description ?? '').trim() || null;
    if (body.grossAmount != null) data.grossAmount = Number(body.grossAmount);
    if (body.retainagePercent != null) data.retainagePercent = Number(body.retainagePercent);
    if (body.netAmount != null) data.netAmount = Number(body.netAmount);
    if (body.costCode !== undefined) {
      data.costCode = String(body.costCode ?? '').trim() || null;
      data.costCodeLabel = data.costCode ? (findCostCode(data.costCode)?.label ?? null) : null;
    }
    if (body.notes !== undefined) data.notes = String(body.notes ?? '').trim() || null;

    // Si cambió el bruto o el retainage y no mandaron neto explícito → recalcular
    if ((body.grossAmount != null || body.retainagePercent != null) && body.netAmount == null) {
      const gross = data.grossAmount ?? invoice.grossAmount;
      const ret = data.retainagePercent ?? invoice.retainagePercent;
      data.netAmount = Math.round(gross * (1 - ret) * 100) / 100;
    }

    const updated = await prisma.subInvoice.update({ where: { id: invoice.id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('sub-invoices PATCH error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE → borra el invoice
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const invoice = await prisma.subInvoice.findFirst({ where: { id: params.id, project: { companyId } } });
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.subInvoice.delete({ where: { id: invoice.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('sub-invoices DELETE error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
