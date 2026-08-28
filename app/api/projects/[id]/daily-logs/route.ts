export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';
import { logDateFromInput, dateKey } from '@/lib/daily-log';
import { sendDailyLogSubmittedEmail } from '@/lib/email';

async function assertProject(projectId: string, companyId: string) {
  return prisma.project.findFirst({ where: { id: projectId, companyId } });
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await assertProject(params.id, companyId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (dateParam) {
      const logDate = logDateFromInput(dateParam);
      const log = await prisma.dailyLog.findUnique({
        where: { projectId_logDate: { projectId: params.id, logDate } },
        include: { photos: { orderBy: { takenAt: 'asc' } } },
      });
      if (!log) {
        return NextResponse.json({ log: null, logDate: logDate.toISOString() });
      }
      const photos = await Promise.all(
        log.photos.map(async (p) => ({
          ...p,
          imageUrl: await getFileUrl(p.cloudStoragePath, false),
        })),
      );
      return NextResponse.json({ log: { ...log, photos } });
    }

    const logs = await prisma.dailyLog.findMany({
      where: { projectId: params.id },
      orderBy: { logDate: 'desc' },
      include: { _count: { select: { photos: true } } },
    });

    return NextResponse.json({
      project: {
        id: project.id,
        projectNumber: project.projectNumber,
        projectName: project.projectName,
      },
      logs,
    });
  } catch (error: any) {
    console.error('GET daily-logs error:', error);
    return NextResponse.json({ error: 'Failed to load daily logs' }, { status: 500 });
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
    const logDate = logDateFromInput(body?.logDate ? String(body.logDate) : dateKey(new Date()));
    const photoIds: string[] = Array.isArray(body?.photoIds) ? body.photoIds : [];

    const existing = await prisma.dailyLog.findUnique({
      where: { projectId_logDate: { projectId: params.id, logDate } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Daily log already exists for this date. Edit the existing log.' }, { status: 409 });
    }

    const log = await prisma.dailyLog.create({
      data: {
        projectId: params.id,
        logDate,
        authorName: body.authorName ? String(body.authorName) : (session.user?.name || 'Superintendent'),
        authorEmail: session.user?.email ?? null,
        weather: body.weather ? String(body.weather) : null,
        temperature: body.temperature ? String(body.temperature) : null,
        workPerformed: body.workPerformed ? String(body.workPerformed) : null,
        crewNotes: body.crewNotes ? String(body.crewNotes) : null,
        deliveries: body.deliveries ? String(body.deliveries) : null,
        delays: body.delays ? String(body.delays) : null,
        status: body.status === 'Submitted' ? 'Submitted' : 'Draft',
      },
    });

    if (photoIds.length) {
      await prisma.sitePhoto.updateMany({
        where: { id: { in: photoIds }, projectId: params.id },
        data: { dailyLogId: log.id },
      });
    }

    // ── NOTIFICACIÓN: Daily Log enviado al PM ──────────────────────────
    if (body.status === 'Submitted') {
      try {
        // Buscar PM del proyecto (en orden de prioridad)
        const pmMember = await prisma.projectMember.findFirst({
          where: { projectId: params.id, role: 'pm' },
          include: { user: { select: { email: true, name: true } } },
        });
        const pmContact = await prisma.projectContact.findFirst({
          where: {
            projectId: params.id,
            role: { contains: 'Manager', mode: 'insensitive' },
            isActive: true,
          },
        });
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
          const withPhotos = await prisma.dailyLog.findUnique({
            where: { id: log.id },
            include: { photos: true },
          });

          await sendDailyLogSubmittedEmail({
            companyId: project.companyId,
            to: pmEmails,
            replyTo: session.user?.email ?? undefined,
            projectName: project.projectName,
            projectNumber: project.projectNumber,
            logDate: log.logDate,
            authorName: log.authorName,
            workPerformed: log.workPerformed,
            crewNotes: log.crewNotes,
            deliveries: log.deliveries,
            delays: log.delays,
            weather: log.weather,
            temperature: log.temperature,
            photoCount: withPhotos?.photos?.length ?? 0,
            logId: params.id,
          });
        }
      } catch (notifyErr: any) {
        console.error('[daily-log] POST notification error:', notifyErr);
      }
    }
    // ────────────────────────────────────────────────────────────────────

    const withPhotos = await prisma.dailyLog.findUnique({
      where: { id: log.id },
      include: { photos: true },
    });

    return NextResponse.json(withPhotos, { status: 201 });
  } catch (error: any) {
    console.error('POST daily-logs error:', error);
    const msg = String(error?.message ?? '');
    if (msg.includes('DailyLog')) {
      return NextResponse.json({
        error: 'Database needs an update. Run scripts/migrate-daily-logs.ts',
        detail: msg,
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to create daily log' }, { status: 500 });
  }
}
