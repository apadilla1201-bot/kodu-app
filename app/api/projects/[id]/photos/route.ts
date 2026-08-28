export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';
import { PHOTO_TAGS, type PhotoTagId } from '@/lib/site-photos';

const VALID_TAGS = new Set(PHOTO_TAGS.map((t) => t.id));

async function assertProject(projectId: string, companyId: string) {
  return prisma.project.findFirst({ where: { id: projectId, companyId } });
}

async function withImageUrl<T extends { cloudStoragePath: string }>(photo: T) {
  const imageUrl = await getFileUrl(photo.cloudStoragePath, false, { inline: true });
  return { ...photo, imageUrl };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await assertProject(params.id, companyId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const area = searchParams.get('area');
    const trade = searchParams.get('trade');
    const search = searchParams.get('search');

    const where: any = { projectId: params.id };

    if (tag && tag !== 'all' && VALID_TAGS.has(tag as PhotoTagId)) {
      where.tag = tag;
    }
    if (area && area !== 'all') {
      where.area = { contains: area, mode: 'insensitive' };
    }
    if (trade && trade !== 'all') {
      where.trade = { contains: trade, mode: 'insensitive' };
    }
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { caption: { contains: q, mode: 'insensitive' } },
        { area: { contains: q, mode: 'insensitive' } },
        { trade: { contains: q, mode: 'insensitive' } },
        { fileName: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (from || to) {
      where.takenAt = {};
      if (from) where.takenAt.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.takenAt.lte = end;
      }
    }

    const photos = await prisma.sitePhoto.findMany({
      where,
      orderBy: { takenAt: 'desc' },
    });

    const withUrls = await Promise.all(photos.map(withImageUrl));

    // Distinct areas and trades for filter dropdowns
    const allPhotos = await prisma.sitePhoto.findMany({
      where: { projectId: params.id },
      select: { area: true, trade: true },
    });
    const areas = [...new Set(allPhotos.map((p) => p.area).filter(Boolean))].sort() as string[];
    const trades = [...new Set(allPhotos.map((p) => p.trade).filter(Boolean))].sort() as string[];

    return NextResponse.json({
      project: {
        id: project.id,
        projectNumber: project.projectNumber,
        projectName: project.projectName,
      },
      photos: withUrls,
      tags: PHOTO_TAGS,
      areas,
      trades,
      total: withUrls.length,
    });
  } catch (error: any) {
    console.error('GET /api/projects/[id]/photos error:', error);
    return NextResponse.json({ error: 'Failed to load photos' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await assertProject(params.id, companyId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await request.json();
    const {
      cloudStoragePath,
      fileName,
      fileType,
      caption,
      area,
      trade,
      tag,
      takenAt,
      latitude,
      longitude,
    } = body ?? {};

    if (!cloudStoragePath || !fileName) {
      return NextResponse.json({ error: 'cloudStoragePath and fileName are required' }, { status: 400 });
    }

    const photoTag = tag && VALID_TAGS.has(tag) ? tag : 'progress';

    const photo = await prisma.sitePhoto.create({
      data: {
        projectId: params.id,
        cloudStoragePath: String(cloudStoragePath),
        fileName: String(fileName),
        fileType: fileType ? String(fileType) : null,
        caption: caption ? String(caption) : null,
        area: area ? String(area) : null,
        trade: trade ? String(trade) : null,
        tag: photoTag,
        takenAt: takenAt ? new Date(takenAt) : new Date(),
        uploadedBy: session.user?.name ?? null,
        uploadedByEmail: session.user?.email ?? null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
      },
    });

    return NextResponse.json(await withImageUrl(photo), { status: 201 });
  } catch (error: any) {
    console.error('POST /api/projects/[id]/photos error:', error);
    const msg = String(error?.message ?? '');
    if (msg.includes('SitePhoto')) {
      return NextResponse.json({
        error: 'Database needs an update. Run scripts/migrate-site-photos.ts',
        detail: msg,
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 });
  }
}
