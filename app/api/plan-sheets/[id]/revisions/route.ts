export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadBufferToStorage } from '@/lib/s3';
import { getApiContext } from '@/lib/plan-room';

const MAX_BYTES = 60 * 1024 * 1024; // los planos en PDF pesan más que fotos

// POST multipart: file + label + revisionDate + notes (+ setCurrent=1)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sheet = await prisma.planSheet.findFirst({
      where: { id: params?.id ?? '', project: { companyId: ctx.companyId } },
      include: { revisions: true },
    });
    if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const formData = await request.formData();
    const label = String(formData.get('label') ?? '').trim();
    if (!label) return NextResponse.json({ error: 'Revision label is required (Original, Permit, Rev A…)' }, { status: 400 });

    const revisionDateRaw = String(formData.get('revisionDate') ?? '').trim();
    const notes = String(formData.get('notes') ?? '').trim();
    const setCurrent = String(formData.get('setCurrent') ?? '1') === '1';

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileIsPublic = false;

    const file = formData.get('file');
    if (file && file instanceof Blob && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large (max 60 MB)' }, { status: 413 });
      }
      fileName = (file as File).name || `plan-${Date.now()}.pdf`;
      const contentType = file.type || 'application/pdf';
      const uploaded = await uploadBufferToStorage(buffer, fileName, contentType, true);
      fileUrl = uploaded.cloud_storage_path;
      fileIsPublic = (uploaded as any).isPublic ?? true;
    }

    const revision = await prisma.$transaction(async (tx) => {
      if (setCurrent) {
        await tx.planRevision.updateMany({ where: { planSheetId: sheet.id }, data: { isCurrent: false } });
      }
      return tx.planRevision.create({
        data: {
          planSheetId: sheet.id,
          label,
          revisionDate: revisionDateRaw ? new Date(revisionDateRaw) : null,
          fileUrl,
          fileName,
          fileIsPublic,
          isCurrent: setCurrent,
          uploadedByName: ctx.userName || null,
          uploadedByEmail: ctx.userEmail || null,
          notes: notes || null,
        },
      });
    });

    return NextResponse.json(revision, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/plan-sheets/[id]/revisions error:', error);
    return NextResponse.json({ error: 'Failed to add revision' }, { status: 500 });
  }
}

// PATCH: { revisionId } → marcar esa revisión como vigente
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sheet = await prisma.planSheet.findFirst({ where: { id: params?.id ?? '', project: { companyId: ctx.companyId } } });
    if (!sheet) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const revisionId = String(body?.revisionId ?? '');
    const rev = await prisma.planRevision.findFirst({ where: { id: revisionId, planSheetId: sheet.id } });
    if (!rev) return NextResponse.json({ error: 'Revision not found' }, { status: 404 });

    await prisma.$transaction([
      prisma.planRevision.updateMany({ where: { planSheetId: sheet.id }, data: { isCurrent: false } }),
      prisma.planRevision.update({ where: { id: rev.id }, data: { isCurrent: true } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('PATCH /api/plan-sheets/[id]/revisions error:', error);
    return NextResponse.json({ error: 'Failed to set current revision' }, { status: 500 });
  }
}
