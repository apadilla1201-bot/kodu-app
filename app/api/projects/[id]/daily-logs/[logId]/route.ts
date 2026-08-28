export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getFileUrl, downloadFileBuffer } from '@/lib/s3';
import { sendDailyLogSubmittedEmail } from '@/lib/email';

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

    // ── NOTIFICACIÓN: Daily Log enviado al PM ──────────────────────────
    const becameSubmitted = body.status === 'Submitted' && existing.status !== 'Submitted';
    if (becameSubmitted) {
      try {
        // Buscar PM del proyecto (en orden de prioridad)
        const project = await prisma.project.findFirst({
          where: { id: params.id, companyId },
          select: { id: true, projectNumber: true, projectName: true, userId: true, companyId: true },
        });
        if (project) {
          // 1) ProjectMember con role='pm'
          const pmMember = await prisma.projectMember.findFirst({
            where: { projectId: params.id, role: 'pm' },
            include: { user: { select: { email: true, name: true } } },
          });
          // 2) ProjectContact con role='Project Manager'
          const pmContact = await prisma.projectContact.findFirst({
            where: {
              projectId: params.id,
              role: { contains: 'Manager', mode: 'insensitive' },
              isActive: true,
            },
          });
          // 3) Creador del proyecto
          const projectOwner = await prisma.user.findUnique({
            where: { id: project.userId },
            select: { email: true, name: true },
          });

          const pmEmails: string[] = [];
          if (pmMember?.user?.email) pmEmails.push(pmMember.user.email);
          if (pmContact?.email) pmEmails.push(pmContact.email);
          if (projectOwner?.email && !pmEmails.includes(projectOwner.email)) {
            pmEmails.push(projectOwner.email);
          }

          if (pmEmails.length) {
            const logWithPhotos = await prisma.dailyLog.findUnique({
              where: { id: params.logId },
              include: { photos: true },
            });

            // Descargar fotos para adjuntar al email (máx 10, máx ~20MB total)
            const attachments: { filename: string; content: string }[] = [];
            const MAX_ATTACH = 10;
            const MAX_BYTES = 20 * 1024 * 1024;
            let totalBytes = 0;
            const photos = logWithPhotos?.photos?.slice(0, MAX_ATTACH) ?? [];
            for (const photo of photos) {
              try {
                const buffer = await downloadFileBuffer(photo.cloudStoragePath);
                if (totalBytes + buffer.length > MAX_BYTES) break;
                attachments.push({
                  filename: photo.fileName || `photo-${photo.id}.jpg`,
                  content: buffer.toString('base64'),
                });
                totalBytes += buffer.length;
              } catch (err) {
                console.warn('[daily-log] failed to download photo for email:', photo.id, err);
              }
            }

            await sendDailyLogSubmittedEmail({
              companyId: project.companyId,
              to: pmEmails,
              replyTo: session.user?.email ?? undefined,
              projectName: project.projectName,
              projectNumber: project.projectNumber,
              logDate: updated.logDate,
              authorName: updated.authorName,
              workPerformed: updated.workPerformed,
              crewNotes: updated.crewNotes,
              deliveries: updated.deliveries,
              delays: updated.delays,
              weather: updated.weather,
              temperature: updated.temperature,
              photoCount: logWithPhotos?.photos?.length ?? 0,
              logId: params.id, // usamos projectId para el link de daily-logs
              attachments: attachments.length ? attachments : undefined,
            });
          }
        }
      } catch (notifyErr: any) {
        // No fallar la operación si el email falla
        console.error('[daily-log] notification error:', notifyErr);
      }
    }
    // ────────────────────────────────────────────────────────────────────

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
