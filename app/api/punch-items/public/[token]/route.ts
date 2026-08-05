export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { uploadBufferToStorage } from '@/lib/s3';

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const item = await prisma.punchItem.findFirst({
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
      itemNumber: item.itemNumber,
      title: item.title,
      description: item.description,
      location: item.location,
      trade: item.trade,
      priority: item.priority,
      status: item.status,
      dueDate: item.dueDate,
      photoUrl: item.photoUrl,
      assignedToName: item.assignedToName,
      projectName: item.project.projectName,
      projectNumber: item.project.projectNumber,
      gcName,
    });
  } catch (error: any) {
    console.error('GET /api/punch-items/public error:', error);
    return NextResponse.json({ error: 'Failed to load punch item' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const item = await prisma.punchItem.findFirst({
      where: { externalToken: params.token },
      include: { project: { select: { projectNumber: true, projectName: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const formData = await request.formData();
    const data: any = { status: 'Ready for Review' };

    const file = formData.get('file');
    if (file && file instanceof Blob) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length === 0) {
        return NextResponse.json({ error: 'Empty file' }, { status: 400 });
      }
      if (buffer.length > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 413 });
      }
      const fileName = String(formData.get('fileName') || (file as File).name || `correction-${Date.now()}`);
      const contentType = String(formData.get('contentType') || file.type || 'application/octet-stream');
      const { cloud_storage_path } = await uploadBufferToStorage(buffer, fileName, contentType, true);
      data.completionPhotoUrl = cloud_storage_path;
      data.completionPhotoName = fileName;
    }

    await prisma.punchItem.update({ where: { id: item.id }, data });

    if (item.createdByEmail) {
      await sendEmail({
        to: item.createdByEmail,
        subject: `✓ Punch item #${item.itemNumber} ready for review — ${item.project.projectNumber}`,
        html: `<p>Punch item <b>#${item.itemNumber} — ${item.title}</b> (project <b>${item.project.projectNumber} — ${item.project.projectName}</b>) was marked <b>Ready for Review</b>${data.completionPhotoUrl ? ' with a correction photo' : ''}.</p><p>Open koduPM → Punch List to verify and close it.</p>`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('POST /api/punch-items/public error:', error);
    return NextResponse.json({ error: 'Failed to update punch item' }, { status: 500 });
  }
}
