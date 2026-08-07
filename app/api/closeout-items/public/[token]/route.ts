export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildBrandedEmailHtml, sendEmail } from '@/lib/email';
import { uploadBufferToStorage } from '@/lib/s3';

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const item = await prisma.closeoutItem.findFirst({
      where: { externalToken: params.token },
      include: {
        project: { select: { projectNumber: true, projectName: true, companyId: true } },
      },
    });
    if (!item) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    let gcName = 'General Contractor';
    if (item.project.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: item.project.companyId },
        select: { name: true },
      });
      if (company?.name) gcName = company.name;
    }

    return NextResponse.json({
      category: item.category,
      deliverable: item.deliverable,
      responsible: item.responsible,
      status: item.status,
      fileName: item.fileName,
      projectName: item.project.projectName,
      projectNumber: item.project.projectNumber,
      gcName,
      alreadyUploaded: Boolean(item.fileUrl),
    });
  } catch (error: any) {
    console.error('GET /api/closeout-items/public error:', error);
    return NextResponse.json({ error: 'Failed to load deliverable' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const item = await prisma.closeoutItem.findFirst({
      where: { externalToken: params.token },
      include: { project: { select: { projectNumber: true, projectName: true, companyId: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 413 });
    }

    const fileName = String(formData.get('fileName') || (file as File).name || `closeout-${Date.now()}.pdf`);
    const contentType = String(formData.get('contentType') || file.type || 'application/octet-stream');
    const { cloud_storage_path } = await uploadBufferToStorage(buffer, fileName, contentType, true);

    await prisma.closeoutItem.update({
      where: { id: item.id },
      data: {
        fileUrl: cloud_storage_path,
        fileName,
        status: 'Received',
        dateReceived: new Date(),
      },
    });

    // Avisar al equipo: al requester original si lo hay
    const notify: string[] = [];
    const creator = await prisma.project.findFirst({
      where: { id: item.projectId },
      select: { user: { select: { email: true } } },
    });
    if (creator?.user?.email) notify.push(creator.user.email);
    if (notify.length) {
      await sendEmail({
        to: notify,
        subject: `✓ Closeout document received: ${item.deliverable} — ${item.project.projectNumber}`,
        html: await buildBrandedEmailHtml({ companyId: item.project.companyId, headerTitle: '✓ Closeout Document Received', body: `<p>The closeout deliverable <b>${item.deliverable}</b> (project <b>${item.project.projectNumber} — ${item.project.projectName}</b>) was uploaded.</p><p>Open koduPM → Closeout to review and verify it.</p>` }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('POST /api/closeout-items/public error:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
