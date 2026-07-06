export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';

export async function GET(
  _request: Request,
  { params }: { params: { id: string; logId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const log = await prisma.dailyLog.findFirst({
      where: {
        id: params.logId,
        projectId: params.id,
        project: { companyId },
      },
      include: { photos: { orderBy: { takenAt: 'asc' } } },
    });
    if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const photos = await Promise.all(
      log.photos.map(async (p) => ({
        ...p,
        imageUrl: await getFileUrl(p.cloudStoragePath, false),
      })),
    );

    return NextResponse.json({ ...log, photos });
  } catch (error: any) {
    console.error('GET daily-log error:', error);
    return NextResponse.json({ error: 'Failed to load daily log' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; logId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.dailyLog.findFirst({
      where: {
        id: params.logId,
        projectId: params.id,
        project: { companyId },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = [
      'weather', 'temperature', 'workPerformed', 'crewNotes', 'deliveries', 'delays', 'status',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f] ? String(body[f]) : null;
    }

    if (body.status === 'Approved') {
      data.approvedBy = session.user?.name ?? null;
      data.approvedAt = new Date();
    }

    const photoIds: string[] | undefined = Array.isArray(body.photoIds) ? body.photoIds : undefined;

    const updated = await prisma.dailyLog.update({
      where: { id: params.logId },
      data,
    });

    if (photoIds) {
      await prisma.sitePhoto.updateMany({
        where: { dailyLogId: params.logId, projectId: params.id },
        data: { dailyLogId: null },
      });
      if (photoIds.length) {
        await prisma.sitePhoto.updateMany({
          where: { id: { in: photoIds }, projectId: params.id },
          data: { dailyLogId: params.logId },
        });
      }
    }

    const withPhotos = await prisma.dailyLog.findUnique({
      where: { id: updated.id },
      include: { photos: true },
    });

    return NextResponse.json(withPhotos);
  } catch (error: any) {
    console.error('PATCH daily-log error:', error);
    return NextResponse.json({ error: 'Failed to update daily log' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; logId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.dailyLog.findFirst({
      where: {
        id: params.logId,
        projectId: params.id,
        project: { companyId },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.sitePhoto.updateMany({
      where: { dailyLogId: params.logId },
      data: { dailyLogId: null },
    });
    await prisma.dailyLog.delete({ where: { id: params.logId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE daily-log error:', error);
    return NextResponse.json({ error: 'Failed to delete daily log' }, { status: 500 });
  }
}
