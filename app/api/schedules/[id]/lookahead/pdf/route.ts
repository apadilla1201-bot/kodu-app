export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import {
  buildExecutiveLookaheadHtml,
  buildFallbackExecutiveContent,
  buildFallbackTechnicalFocus,
  buildTechnicalLookaheadHtml,
  extractAction,
  lookaheadPdfFilename,
  type ExecutiveContent,
  type LookAheadActivity,
  type LookAheadPdfInput,
  type TechnicalFocusItem,
} from '@/lib/ritz-lookahead-pdf';

function fmtMonthDay(d: Date | string | null) {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDayRange(start: Date, end: Date) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[start.getDay()]} ${months[start.getMonth()]} ${start.getDate()} THROUGH ${days[end.getDay()]} ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

async function callLlmJson<T>(system: string, user: string, fallback: T): Promise<T> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) return fallback;
  try {
    const llmResponse = await fetch('https://api.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        max_tokens: 2500,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!llmResponse.ok) return fallback;
    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) return fallback;
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return fallback;
  }
}

async function generateExecutiveContent(
  input: LookAheadPdfInput,
  actSummary: string,
  critSummary: string
): Promise<ExecutiveContent> {
  const fallback = buildFallbackExecutiveContent(input);
  const parsed = await callLlmJson<Partial<ExecutiveContent>>(
    `You write Ritz-Carlton residence executive look-ahead annexes matching the Meeting 07 reference format exactly.
Output JSON only:
{
  "status": "ON TRACK" | "AT RISK" | "DELAYED",
  "statusNarrative": "1-2 sentences, owner-facing",
  "siteOperations": [{"title": "Short Headline", "description": "1-2 sentences italic tone"}],
  "offSiteProduction": [{"title": "Short Headline", "description": "1-2 sentences"}],
  "ownerAction": {"title": "...", "deadline": "Month D, YYYY", "status": "IN PROGRESS – AWAITING LOCK", "description": "3-4 sentences on cascade impact"} or null,
  "executiveBrief": "one paragraph, no prefix"
}
Use exactly 3 site items and 3 off-site items. Titles like "Partition Framing Begins", "Main Kitchen Fabrication". Never use activity IDs.`,
    `Project: ${input.projectName}
Owner: ${input.client || 'Owner'}
CPM: ${input.revision}
Window: ${fmtDayRange(input.windowStart, input.windowEnd)}

Look-ahead activities:
${actSummary}

Critical path context:
${critSummary || 'None'}`,
    fallback
  );

  return {
    status: ['ON TRACK', 'AT RISK', 'DELAYED'].includes(parsed.status || '')
      ? (parsed.status as ExecutiveContent['status'])
      : fallback.status,
    statusNarrative: parsed.statusNarrative || fallback.statusNarrative,
    siteOperations:
      Array.isArray(parsed.siteOperations) && parsed.siteOperations.length
        ? parsed.siteOperations
        : fallback.siteOperations,
    offSiteProduction:
      Array.isArray(parsed.offSiteProduction) && parsed.offSiteProduction.length
        ? parsed.offSiteProduction
        : fallback.offSiteProduction,
    ownerAction: parsed.ownerAction?.title ? parsed.ownerAction : fallback.ownerAction,
    executiveBrief: parsed.executiveBrief || fallback.executiveBrief,
  };
}

async function generateTechnicalFocus(
  input: LookAheadPdfInput,
  actSummary: string
): Promise<TechnicalFocusItem[]> {
  const fallback = buildFallbackTechnicalFocus(input);
  const parsed = await callLlmJson<TechnicalFocusItem[]>(
    `You write CRITICAL FOCUS sidebar for Ritz-Carlton technical look-ahead (Meeting 07 reference).
Output JSON array of 4-5 items:
[{"heading": "OWNER KEY DECISION (TF: 0D)", "title": "...", "body": "2-3 sentences"}]
Use headings: OWNER KEY DECISION (TF: 0D), CRITICAL PATH (TF: 0D), PHASE TRANSITION, COORDINATION WATCH (TF: X–YD), PROCUREMENT ASSURANCE.`,
    `Project: ${input.projectName}
Window: ${fmtDayRange(input.windowStart, input.windowEnd)}

Activities:
${actSummary}`,
    fallback
  );
  return Array.isArray(parsed) && parsed.length ? parsed : fallback;
}

function selectLookAheadActivities(
  allActivities: {
    id: string;
    activityId: string;
    activityName: string;
    activityType: string;
    originalDuration: number;
    remainingDuration: number;
    percentComplete: number;
    startDate: Date | null;
    finishDate: Date | null;
    status: string;
    floatDays: number;
    notes: string | null;
    resourceName: string | null;
    isLookAhead: boolean;
    sortOrder: number;
  }[],
  windowStart: Date,
  windowEnd: Date
) {
  const laOnly = allActivities.filter((a) => a.isLookAhead);
  if (laOnly.length > 0) return laOnly;

  const cpmInWindow = allActivities.filter((a) => {
    if (a.isLookAhead) return false;
    if (a.activityType.startsWith('group_')) return false;
    if (a.status === 'done') return false;
    if (!a.startDate) return false;
    const start = new Date(a.startDate);
    const end = a.finishDate ? new Date(a.finishDate) : start;
    return start <= windowEnd && end >= windowStart;
  });

  const seen = new Set<string>();
  return cpmInWindow.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Auth' }, { status: 401 });
    const companyId = (session?.user as any)?.companyId ?? '';

    const schedule = await prisma.schedule.findFirst({
      where: { id: params.id, project: { companyId } },
      include: {
        activities: { orderBy: { sortOrder: 'asc' } },
        project: { select: { projectName: true, projectNumber: true, client: true, location: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let bodyData: { startDate?: string; type?: 'executive' | 'technical' } = {};
    try {
      bodyData = await request.json();
    } catch {
      /* empty body ok */
    }

    const reportType = bodyData.type === 'technical' ? 'technical' : 'executive';
    const windowStart = bodyData.startDate ? new Date(bodyData.startDate) : new Date(schedule.dataDate);
    if (isNaN(windowStart.getTime())) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
    const windowEnd = new Date(windowStart.getTime() + 13 * 86400000);

    const windowActivities = selectLookAheadActivities(schedule.activities, windowStart, windowEnd);

    const activities: LookAheadActivity[] = windowActivities.map((a) => ({
      id: a.id,
      activityId: a.activityId,
      activityName: a.activityName,
      originalDuration: a.originalDuration,
      remainingDuration: a.remainingDuration,
      percentComplete: a.percentComplete,
      startDate: a.startDate,
      finishDate: a.finishDate,
      status: a.status,
      floatDays: a.floatDays,
      notes: a.notes,
      resourceName: a.resourceName,
      isLookAhead: a.isLookAhead,
    }));

    const actSummary = activities
      .map((a) => {
        const { cleanName, action } = extractAction(a.activityName);
        const notes = a.notes ? ` | Notes: ${a.notes}` : '';
        return `${a.activityId}: ${cleanName} | ${action || 'CONTINUE'} | ${fmtMonthDay(a.startDate)}–${fmtMonthDay(a.finishDate)} | ${a.status} | TF ${a.floatDays}d${notes}`;
      })
      .join('\n');

    const allCritical = schedule.activities.filter(
      (a) => a.floatDays <= 1 && a.status !== 'done' && !a.activityType.startsWith('group_')
    );
    const critSummary = allCritical
      .slice(0, 10)
      .map((a) => `${a.activityId}: ${a.activityName} | TF ${a.floatDays}d`)
      .join('\n');

    const userName = (session.user as any)?.name || 'A. Padilla';
    const pdfInput: LookAheadPdfInput = {
      projectName: schedule.project.projectName || 'Project',
      projectNumber: schedule.project.projectNumber || '',
      client: schedule.project.client,
      location: schedule.project.location,
      revision: schedule.revision || '',
      dataDate: new Date(schedule.dataDate),
      tcoDate: schedule.tcoDate ? new Date(schedule.tcoDate) : null,
      windowStart,
      windowEnd,
      preparedBy: userName,
      activities,
      executive: buildFallbackExecutiveContent({
        activities,
        windowStart,
        windowEnd,
        tcoDate: schedule.tcoDate ? new Date(schedule.tcoDate) : null,
      }),
    };

    if (reportType === 'executive') {
      pdfInput.executive = await generateExecutiveContent(pdfInput, actSummary, critSummary);
    } else {
      pdfInput.technicalFocus = await generateTechnicalFocus(pdfInput, actSummary);
    }

    const html =
      reportType === 'technical'
        ? buildTechnicalLookaheadHtml(pdfInput)
        : buildExecutiveLookaheadHtml(pdfInput);

    const pdfBuf = await htmlToPdf(html, {
      format: reportType === 'technical' ? 'Tabloid' : 'Letter',
      landscape: reportType === 'technical',
      margin:
        reportType === 'technical'
          ? { top: '4mm', right: '3mm', bottom: '4mm', left: '3mm' }
          : { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      scale: reportType === 'technical' ? 0.88 : 1,
    });

    const safeName = lookaheadPdfFilename(
      reportType,
      schedule.project.projectNumber || 'LA',
      schedule.revision || '',
      windowStart
    );

    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuf.length),
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    });
  } catch (err) {
    console.error('Look-ahead PDF error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
