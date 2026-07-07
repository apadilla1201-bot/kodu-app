export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import { dateKey, logDateFromInput, weekRangeEnding } from '@/lib/daily-log';
import {
  autoActionItems,
  autoMilestones,
  autoOpenItems,
  autoOverview,
  autoPhotoIntro,
  buildFieldReportHtml,
  formatTcoTarget,
  type FieldReportData,
  type FieldReportMilestone,
} from '@/lib/field-report-pdf';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const defaults = weekRangeEnding();
    const from = String(body?.from || defaults.from).slice(0, 10);
    const to = String(body?.to || defaults.to).slice(0, 10);

    const fromDate = logDateFromInput(from);
    const toDate = logDateFromInput(to);
    toDate.setHours(23, 59, 59, 999);

    if (fromDate > toDate) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const [logs, photos, openRfis, submittals, schedule] = await Promise.all([
      prisma.dailyLog.findMany({
        where: {
          projectId: params.id,
          logDate: { gte: fromDate, lte: toDate },
        },
        include: { photos: { orderBy: { takenAt: 'asc' } } },
        orderBy: { logDate: 'asc' },
      }),
      prisma.sitePhoto.findMany({
        where: {
          projectId: params.id,
          takenAt: { gte: fromDate, lte: toDate },
        },
        orderBy: { takenAt: 'asc' },
      }),
      prisma.rFI.findMany({
        where: {
          projectId: params.id,
          status: { in: ['Open', 'Pending', 'Submitted'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          rfiNumber: true,
          subject: true,
          question: true,
          status: true,
          priority: true,
          dateDue: true,
          assignedTo: true,
          ballInCourt: true,
        },
      }),
      prisma.submittal.findMany({
        where: {
          projectId: params.id,
          OR: [
            { submittedDate: { gte: fromDate, lte: toDate } },
            { updatedAt: { gte: fromDate, lte: toDate } },
          ],
        },
        orderBy: { submittalNumber: 'asc' },
        take: 12,
        select: {
          submittalNumber: true,
          title: true,
          status: true,
          subcontractor: true,
          submittedDate: true,
        },
      }),
      prisma.schedule.findFirst({
        where: { projectId: params.id, status: 'Active' },
        select: { tcoDate: true, projectFinish: true },
      }),
    ]);

    if (!logs.length && !photos.length) {
      return NextResponse.json({
        error: 'No hay daily logs ni fotos en este rango de fechas. Amplía las fechas o agrega datos de campo.',
      }, { status: 400 });
    }

    const photosByDayMap = new Map<string, typeof photos>();
    for (const p of photos) {
      const key = dateKey(p.takenAt);
      if (!photosByDayMap.has(key)) photosByDayMap.set(key, []);
      photosByDayMap.get(key)!.push(p);
    }

    const photosByDay = [...photosByDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayPhotos]) => ({
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }),
        photos: dayPhotos,
      }));

    const mapPhoto = (p: (typeof photos)[0]) => ({
      id: p.id,
      fileName: p.fileName,
      cloudStoragePath: p.cloudStoragePath,
      fileType: p.fileType,
      caption: p.caption,
      area: p.area,
      trade: p.trade,
      tag: p.tag,
      takenAt: p.takenAt,
    });

    const mappedLogs = logs.map((l) => ({
      id: l.id,
      logDate: l.logDate,
      authorName: l.authorName,
      weather: l.weather,
      temperature: l.temperature,
      workPerformed: l.workPerformed,
      crewNotes: l.crewNotes,
      deliveries: l.deliveries,
      delays: l.delays,
      status: l.status,
      photos: l.photos.map(mapPhoto),
    }));

    const mappedRfis = openRfis.map((r) => ({
      rfiNumber: r.rfiNumber,
      subject: r.subject,
      question: r.question,
      status: r.status,
      priority: r.priority,
      dateDue: r.dateDue,
      assignedTo: r.assignedTo,
      ballInCourt: r.ballInCourt,
    }));

    const mappedSubmittals = submittals.map((s) => ({
      submittalNumber: s.submittalNumber,
      title: s.title,
      status: s.status,
      subcontractor: s.subcontractor,
      submittedDate: s.submittedDate,
    }));

    const tcoFromSchedule = formatTcoTarget(schedule?.tcoDate ?? schedule?.projectFinish);

    const customMilestones = Array.isArray(body?.milestones)
      ? (body.milestones as FieldReportMilestone[]).filter((m) => m?.title?.trim())
      : null;

    const reportData: FieldReportData = {
      projectNumber: project.projectNumber,
      projectName: project.projectName,
      client: project.client ?? null,
      location: project.location ?? null,
      from,
      to,
      preparedBy: session.user?.name || 'Project Team',
      tcoTarget: String(body?.tcoTarget || '').trim() || tcoFromSchedule,
      overview: String(body?.overview || '').trim() || autoOverview(project, mappedLogs),
      photoIntro: String(body?.photoIntro || '').trim() || autoPhotoIntro(),
      logs: mappedLogs,
      photosByDay: photosByDay.map((d) => ({
        ...d,
        photos: d.photos.map(mapPhoto),
      })),
      milestones: customMilestones?.length
        ? customMilestones
        : autoMilestones(mappedSubmittals, mappedLogs),
      openItems: autoOpenItems(mappedRfis, mappedLogs),
      actionItems: autoActionItems(mappedRfis, mappedLogs),
      openRfis: mappedRfis,
    };

    const html = await buildFieldReportHtml(reportData);
    const pdfBytes = await htmlToPdf(html, {
      format: 'Letter',
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });

    const reportDate = new Date(`${to}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).replace(/,/g, '').replace(/ /g, '_');
    const fname = `REPORT_${project.projectNumber}_${reportDate}.pdf`;
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fname}"`,
      },
    });
  } catch (error: any) {
    console.error('Field report PDF error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate field report' }, { status: 500 });
  }
}
