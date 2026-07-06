export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getFileUrl, deleteFile } from '@/lib/s3';
import { PHOTO_TAGS, type PhotoTagId } from '@/lib/site-photos';

const VALID_TAGS = new Set(PHOTO_TAGS.map((t) => t.id));

export async function GET(
  _request: Request,
  { params }: { params: { id: string; photoId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const photo = await prisma.sitePhoto.findFirst({
      where: {
        id: params.photoId,
        projectId: params.id,
        project: { companyId },
      },
    });
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const imageUrl = await getFileUrl(photo.cloudStoragePath, false);
    return NextResponse.json({ ...photo, imageUrl });
  } catch (error: any) {
    console.error('GET photo error:', error);
    return NextResponse.json({ error: 'Failed to load photo' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; photoId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.sitePhoto.findFirst({
      where: {
        id: params.photoId,
        projectId: params.id,
        project: { companyId },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.caption !== undefined) data.caption = body.caption ? String(body.caption) : null;
    if (body.area !== undefined) data.area = body.area ? String(body.area) : null;
    if (body.trade !== undefined) data.trade = body.trade ? String(body.trade) : null;
    if (body.tag !== undefined && VALID_TAGS.has(body.tag)) data.tag = body.tag;
    if (body.takenAt !== undefined) data.takenAt = new Date(body.takenAt);

    const updated = await prisma.sitePhoto.update({
      where: { id: params.photoId },
      data,
    });

    const imageUrl = await getFileUrl(updated.cloudStoragePath, false);
    return NextResponse.json({ ...updated, imageUrl });
  } catch (error: any) {
    console.error('PATCH photo error:', error);
    return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; photoId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.sitePhoto.findFirst({
      where: {
        id: params.photoId,
        projectId: params.id,
        project: { companyId },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    try {
      await deleteFile(existing.cloudStoragePath);
    } catch (fileErr) {
      console.warn('Photo file delete skipped:', fileErr);
    }

    await prisma.sitePhoto.delete({ where: { id: params.photoId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE photo error:', error);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}
