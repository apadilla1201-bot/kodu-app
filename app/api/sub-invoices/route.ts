export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { uploadBufferToStorage } from '@/lib/s3';
import { findCostCode } from '@/lib/cost-codes';

const MAX_BYTES = 25 * 1024 * 1024;

// GET → lista los invoices de subs de los proyectos de la empresa (opcional ?projectId)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';
    if (!companyId) return NextResponse.json([]);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') ?? undefined;

    const items = await prisma.subInvoice.findMany({
      where: { project: { companyId }, ...(projectId ? { projectId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { projectNumber: true, projectName: true } } },
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error('sub-invoices GET error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST → crea un invoice de sub (con su PDF original). Solo Admin/Owner/PM.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const projectId = String(formData.get('projectId') ?? '');
    const subcontractor = String(formData.get('subcontractor') ?? '').trim();
    const grossAmount = Number(formData.get('grossAmount') ?? 0);
    const retainagePercent = formData.get('retainagePercent') != null && formData.get('retainagePercent') !== ''
      ? Number(formData.get('retainagePercent'))
      : 0.05;
    // neto: si el PM lo manda editado lo respetamos; si no, bruto * (1 - retainage)
    const netAmountRaw = formData.get('netAmount');
    const netAmount = netAmountRaw != null && netAmountRaw !== ''
      ? Number(netAmountRaw)
      : Math.round(grossAmount * (1 - retainagePercent) * 100) / 100;
    const costCode = String(formData.get('costCode') ?? '').trim() || null;
    const invoiceNumber = String(formData.get('invoiceNumber') ?? '').trim() || null;
    const description = String(formData.get('description') ?? '').trim() || null;
    const notes = String(formData.get('notes') ?? '').trim() || null;

    if (!projectId || !subcontractor) {
      return NextResponse.json({ error: 'projectId and subcontractor are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // PDF original del sub (opcional pero recomendado)
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    const file = formData.get('file');
    if (file && file instanceof Blob && (file as File).size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 413 });
      }
      fileName = String(formData.get('fileName') || (file as File).name || `invoice-${Date.now()}.pdf`);
      const contentType = String(formData.get('contentType') || file.type || 'application/pdf');
      const { cloud_storage_path } = await uploadBufferToStorage(buffer, fileName, contentType, true);
      fileUrl = cloud_storage_path;
    }

    const costCodeLabel = costCode ? (findCostCode(costCode)?.label ?? null) : null;

    const created = await prisma.subInvoice.create({
      data: {
        projectId,
        subcontractor,
        invoiceNumber,
        description,
        grossAmount,
        retainagePercent,
        netAmount,
        costCode,
        costCodeLabel,
        fileUrl,
        fileName,
        status: 'Pending',
        notes,
        createdByName: (session.user as any)?.name ?? null,
        createdByEmail: (session.user as any)?.email ?? null,
      },
    });

    return NextResponse.json(created);
  } catch (err) {
    console.error('sub-invoices POST error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
