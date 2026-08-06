export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { uploadBufferToStorage } from '@/lib/s3';

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role) && role !== 'superintendent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const item = await prisma.closeoutItem.findFirst({
      where: { id: params.id, project: { companyId } },
    });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

    const fileName = String(formData.get('fileName') || (file as File).name || `doc-${Date.now()}`);
    const contentType = String(formData.get('contentType') || file.type || 'application/octet-stream');
    const { cloud_storage_path } = await uploadBufferToStorage(buffer, fileName, contentType, true);

    const updated = await prisma.closeoutItem.update({
      where: { id: item.id },
      data: {
        fileUrl: cloud_storage_path,
        fileName,
        status: item.status === 'Pending' || item.status === 'Requested' ? 'Received' : item.status,
        dateReceived: item.dateReceived ?? new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('POST /api/closeout-items/[id]/file error:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
