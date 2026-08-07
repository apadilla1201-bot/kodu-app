export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, disciplineFromSheet, parseFileName } from '@/lib/plan-room';

// POST { projectId, planSetId?, items: [{ fileName, fileUrl, fileIsPublic, sheetNumber?, title?, label?, revisionDate? }] }
// Crea plano+revisión; si el plano ya existe → agrega la revisión (sin marcar vigente por defecto).
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ctx.canUpload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { projectId, planSetId, items } = body ?? {};
    if (!projectId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'projectId and items[] are required' }, { status: 400 });
    }
    if (items.length > 50) {
      return NextResponse.json({ error: 'Max 50 files per batch' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId: ctx.companyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const results: { fileName: string; sheetNumber: string; action: string }[] = [];

    for (const raw of items) {
      const parsed = parseFileName(String(raw?.fileName ?? ''));
      const num = String(raw?.sheetNumber ?? parsed.sheetNumber).trim().toUpperCase();
      const title = String(raw?.title ?? parsed.title).trim() || parsed.title;
      const label = String(raw?.label ?? 'Original').trim() || 'Original';
      const revisionDate = raw?.revisionDate ? new Date(raw.revisionDate) : null;

      const existing = await prisma.planSheet.findFirst({ where: { projectId, sheetNumber: num } });
      if (existing) {
        await prisma.planRevision.create({
          data: {
            planSheetId: existing.id,
            label,
            revisionDate,
            fileUrl: raw?.fileUrl ?? null,
            fileName: raw?.fileName ?? null,
            fileIsPublic: Boolean(raw?.fileIsPublic ?? true),
            isCurrent: false, // nunca pisa la vigente en bulk
            uploadedByName: ctx.userName || null,
            uploadedByEmail: ctx.userEmail || null,
          },
        });
        results.push({ fileName: raw?.fileName ?? '', sheetNumber: num, action: 'revision_added' });
      } else {
        await prisma.planSheet.create({
          data: {
            projectId,
            planSetId: planSetId || null,
            sheetNumber: num,
            title,
            discipline: disciplineFromSheet(num),
            revisions: {
              create: {
                label,
                revisionDate,
                fileUrl: raw?.fileUrl ?? null,
                fileName: raw?.fileName ?? null,
                fileIsPublic: Boolean(raw?.fileIsPublic ?? true),
                isCurrent: true,
                uploadedByName: ctx.userName || null,
                uploadedByEmail: ctx.userEmail || null,
              },
            },
          },
        });
        results.push({ fileName: raw?.fileName ?? '', sheetNumber: num, action: 'created' });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error: any) {
    console.error('POST /api/plan-sheets/bulk error:', error);
    if (String(error?.message ?? '').includes('does not exist')) {
      return NextResponse.json({ error: 'migration_pending' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to bulk import plans' }, { status: 500 });
  }
}
