export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { uploadBufferToStorage } from '@/lib/s3';

const MAX_BYTES = 25 * 1024 * 1024;

const TYPE_LABELS: Record<string, string> = {
  conditional_progress: 'Conditional Waiver — Progress Payment',
  unconditional_progress: 'Unconditional Waiver — Progress Payment',
  conditional_final: 'Conditional Waiver — Final Payment',
  unconditional_final: 'Unconditional Waiver — Final Payment',
};

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const waiver = await prisma.lienWaiver.findFirst({
      where: { externalToken: params.token },
      include: {
        project: { select: { projectNumber: true, projectName: true, client: true, companyId: true } },
      },
    });
    if (!waiver) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    let gcName = 'General Contractor';
    if (waiver.project.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: waiver.project.companyId },
        select: { name: true },
      });
      if (company?.name) gcName = company.name;
    }

    return NextResponse.json({
      subcontractor: waiver.subcontractor,
      typeLabel: TYPE_LABELS[waiver.waiverType] ?? waiver.waiverType,
      amount: waiver.amount,
      throughDate: waiver.throughDate,
      status: waiver.status,
      fileName: waiver.fileName,
      projectName: waiver.project.projectName,
      projectNumber: waiver.project.projectNumber,
      owner: waiver.project.client,
      gcName,
      alreadyUploaded: Boolean(waiver.fileUrl),
    });
  } catch (error: any) {
    console.error('GET /api/lien-waivers/public error:', error);
    return NextResponse.json({ error: 'Failed to load waiver' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const waiver = await prisma.lienWaiver.findFirst({
      where: { externalToken: params.token },
      include: { project: { select: { projectNumber: true, projectName: true } } },
    });
    if (!waiver) {
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

    const fileName = String(formData.get('fileName') || (file as File).name || `waiver-${Date.now()}.pdf`);
    const contentType = String(formData.get('contentType') || file.type || 'application/octet-stream');
    const { cloud_storage_path } = await uploadBufferToStorage(buffer, fileName, contentType, true);

    await prisma.lienWaiver.update({
      where: { id: waiver.id },
      data: {
        fileUrl: cloud_storage_path,
        fileName,
        status: 'Received',
        receivedAt: new Date(),
      },
    });

    if (waiver.createdByEmail) {
      await sendEmail({
        to: waiver.createdByEmail,
        subject: `✓ Signed lien waiver received — ${waiver.subcontractor} (${waiver.project.projectNumber})`,
        html: `<p><b>${waiver.subcontractor}</b> uploaded the signed lien waiver for project <b>${waiver.project.projectNumber} — ${waiver.project.projectName}</b>.</p><p>Open koduPM → Lien Waivers to review and approve it.</p>`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('POST /api/lien-waivers/public error:', error);
    return NextResponse.json({ error: 'Failed to upload signed waiver' }, { status: 500 });
  }
}
