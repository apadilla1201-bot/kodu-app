export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import {
  buildExecutiveLookaheadHtml,
  buildFallbackExecutiveContent,
  buildTechnicalLookaheadHtml,
  extractAction,
  lookaheadPdfFilename,
  type ExecutiveContent,
  type LookAheadActivity,
  type LookAheadPdfInput,
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

async function generateExecutiveContent(
  input: LookAheadPdfInput,
  actSummary: string,
  critSummary: string,
  counts: { starts: number; finishes: number; continues: number; critical: number }
): Promise<ExecutiveContent> {
  const fallback = buildFallbackExecutiveContent(input);
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const llmResponse = await fetch('https://api.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: `You write executive 2-week construction look-ahead annexes for luxury residential owners. Output JSON only:
{
  "status": "ON TRACK" | "AT RISK" | "DELAYED",
  "statusNarrative": "2-3 sentences",
  "siteOperations": [{"title": "...", "description": "..."}],
  "offSiteProduction": [{"title": "...", "description": "..."}],
  "ownerAction": {"title": "...", "deadline": "...", "status": "...", "description": "..."} or null,
  "executiveBrief": "1 elegant paragraph"
}
Use 3-6 site items and 2-5 off-site items. Tone: confident, precise, Ritz-level professionalism.`,
          },
          {
            role: 'user',
            content: `Project: ${input.projectName}
Owner: ${input.client || 'Owner'}
TCO: ${input.tcoDate ? fmtMonthDay(input.tcoDate) : 'TBD'}
CPM: ${input.revision}
Data Date: ${fmtMonthDay(input.dataDate)}
Window: ${fmtDayRange(input.windowStart, input.windowEnd)}

Activities (${input.activities.length}):
${actSummary}

Critical path:
${critSummary || 'None'}

Starts: ${counts.starts} | Finishes: ${counts.finishes} | Continues: ${counts.continues} | Critical in window: ${counts.critical}`,
          },
        ],
      }),
    });

    if (!llmResponse.ok) return fallback;
    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      status: ['ON TRACK', 'AT RISK', 'DELAYED'].includes(parsed.status) ? parsed.status : fallback.status,
      statusNarrative: parsed.statusNarrative || fallback.statusNarrative,
      siteOperations: Array.isArray(parsed.siteOperations) && parsed.siteOperations.length
        ? parsed.siteOperations
        : fallback.siteOperations,
      offSiteProduction: Array.isArray(parsed.offSiteProduction) && parsed.offSiteProduction.length
        ? parsed.offSiteProduction
        : fallback.offSiteProduction,
      ownerAction: parsed.ownerAction?.title ? parsed.ownerAction : fallback.ownerAction,
      executiveBrief: parsed.executiveBrief || fallback.executiveBrief,
    };
  } catch {
    return fallback;
  }
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

    const cpmInWindow = schedule.activities.filter((a) => {
      if (a.isLookAhead) return false;
      if (a.activityType.startsWith('group_')) return false;
      if (a.status === 'done') return false;
      if (!a.startDate) return false;
      const start = new Date(a.startDate);
      const end = a.finishDate ? new Date(a.finishDate) : start;
      return start <= windowEnd && end >= windowStart;
    });

    const laActivities = schedule.activities.filter((a) => a.isLookAhead);
    const seen = new Set<string>();
    const windowActivities = [...cpmInWindow, ...laActivities].filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

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

    let starts = 0;
    let finishes = 0;
    let continues = 0;
    let critical = 0;
    for (const act of activities) {
      const { action } = extractAction(act.activityName);
      if (act.floatDays === 0 && act.status !== 'done') critical++;
      if (action.includes('START') && action.includes('FINISH')) continues++;
      else if (action.includes('FINISH')) finishes++;
      else if (action.includes('START')) starts++;
      else if (action.includes('CONTINU')) continues++;
      else {
        const s = act.startDate;
        const f = act.finishDate;
        if (s && s >= windowStart && s <= windowEnd) starts++;
        else if (f && f >= windowStart && f <= windowEnd) finishes++;
        else continues++;
      }
    }

    const actSummary = activities
      .map((a) => {
        const { cleanName, action } = extractAction(a.activityName);
        return `${a.activityId.replace('LA-', '')}: ${cleanName} | ${action || 'N/A'} | ${a.status} | TF ${a.floatDays}d`;
      })
      .join('\n');

    const allCritical = schedule.activities.filter(
      (a) => a.floatDays === 0 && a.status !== 'done' && !a.isLookAhead && !a.activityType.startsWith('group_')
    );
    const critSummary = allCritical
      .slice(0, 10)
      .map((a) => `${a.activityId}: ${a.activityName} | TF ${a.floatDays}d`)
      .join('\n');

    const userName = (session.user as any)?.name || 'Project Manager';
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
      pdfInput.executive = await generateExecutiveContent(pdfInput, actSummary, critSummary, {
        starts,
        finishes,
        continues,
        critical,
      });
    }

    const html =
      reportType === 'technical'
        ? buildTechnicalLookaheadHtml(pdfInput)
        : buildExecutiveLookaheadHtml(pdfInput);

    const pdfBuf = await htmlToPdf(html, {
      format: 'Letter',
      landscape: reportType === 'technical',
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
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
