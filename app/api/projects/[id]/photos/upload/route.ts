export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getFileUrl, uploadBufferToStorage } from '@/lib/s3';
import { PHOTO_TAGS, type PhotoTagId } from '@/lib/site-photos';

const VALID_TAGS = new Set(PHOTO_TAGS.map((t) => t.id));
const MAX_BYTES = 10 * 1024 * 1024;

async function assertProject(projectId: string, companyId: string) {
  return prisma.project.findFirst({ where: { id: projectId, companyId } });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await assertProject(params.id, companyId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

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
      return NextResponse.json({ error: 'Archivo muy grande (máx 10 MB)' }, { status: 413 });
    }

    const fileName = String(formData.get('fileName') || (file as File).name || `photo-${Date.now()}.jpg`);
    const contentType = String(formData.get('contentType') || file.type || 'image/jpeg');
    const captionRaw = formData.get('caption');
    const tagRaw = formData.get('tag');
    const caption = captionRaw ? String(captionRaw) : null;
    const photoTag = tagRaw && VALID_TAGS.has(String(tagRaw) as PhotoTagId) ? String(tagRaw) : 'progress';

    const { cloud_storage_path } = await uploadBufferToStorage(buffer, fileName, contentType, false);

    const photo = await prisma.sitePhoto.create({
      data: {
        projectId: params.id,
        cloudStoragePath: cloud_storage_path,
        fileName,
        fileType: contentType,
        caption,
        tag: photoTag,
        takenAt: new Date(),
        uploadedBy: session.user?.name ?? null,
        uploadedByEmail: session.user?.email ?? null,
      },
    });

    const imageUrl = await getFileUrl(photo.cloudStoragePath, false, { inline: true });
    return NextResponse.json({ ...photo, imageUrl }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/projects/[id]/photos/upload error:', error);
    const msg = String(error?.message ?? '');
    if (msg.includes('SitePhoto')) {
      return NextResponse.json({
        error: 'Database needs an update. Run scripts/migrate-site-photos.ts',
        detail: msg,
      }, { status: 500 });
    }
    return NextResponse.json({ error: msg || 'Failed to upload photo' }, { status: 500 });
  }
}
