export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import { dateKey, logDateFromInput, weekRangeEnding } from '@/lib/daily-log';
import { buildFieldReportHtml, type FieldReportData } from '@/lib/field-report-pdf';

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

    const [logs, photos, openRfis] = await Promise.all([
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
        take: 15,
        select: { rfiNumber: true, subject: true, status: true, priority: true },
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

    const reportData: FieldReportData = {
      projectNumber: project.projectNumber,
      projectName: project.projectName,
      client: project.client ?? null,
      location: project.location ?? null,
      from,
      to,
      preparedBy: session.user?.name || 'Project Team',
      logs: logs.map((l) => ({
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
        photos: l.photos.map((p) => ({
          id: p.id,
          fileName: p.fileName,
          cloudStoragePath: p.cloudStoragePath,
          fileType: p.fileType,
          caption: p.caption,
          area: p.area,
          trade: p.trade,
          tag: p.tag,
          takenAt: p.takenAt,
        })),
      })),
      photosByDay: photosByDay.map((d) => ({
        ...d,
        photos: d.photos.map((p) => ({
          id: p.id,
          fileName: p.fileName,
          cloudStoragePath: p.cloudStoragePath,
          fileType: p.fileType,
          caption: p.caption,
          area: p.area,
          trade: p.trade,
          tag: p.tag,
          takenAt: p.takenAt,
        })),
      })),
      openRfis,
    };

    const html = await buildFieldReportHtml(reportData);
    const pdfBytes = await htmlToPdf(html, {
      format: 'Letter',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    const fname = `Field_Report_${project.projectNumber}_${from}_to_${to}.pdf`;
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
