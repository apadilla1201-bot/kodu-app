export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { askClaudeJSON } from '@/lib/ai';
import { logDateFromInput } from '@/lib/daily-log';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const from = String(body?.from || '').slice(0, 10);
    const to = String(body?.to || '').slice(0, 10);
    const wordContext = String(body?.wordContext || '').trim();

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to dates are required' }, { status: 400 });
    }

    const fromDate = logDateFromInput(from);
    const toDate = logDateFromInput(to);
    toDate.setHours(23, 59, 59, 999);

    if (fromDate > toDate) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const [logs, rfis, submittals] = await Promise.all([
      prisma.dailyLog.findMany({
        where: {
          projectId: params.id,
          logDate: { gte: fromDate, lte: toDate },
        },
        orderBy: { logDate: 'asc' },
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
    ]);

    // Build context for AI
    const logEntries = logs.map((l) => {
      const parts: string[] = [];
      if (l.workPerformed) parts.push(`Work: ${l.workPerformed}`);
      if (l.crewNotes) parts.push(`Crew: ${l.crewNotes}`);
      if (l.deliveries) parts.push(`Deliveries: ${l.deliveries}`);
      if (l.delays) parts.push(`Delays/Issues: ${l.delays}`);
      if (l.weather) parts.push(`Weather: ${l.weather}`);
      return `Date: ${l.logDate.toISOString().split('T')[0]} | Author: ${l.authorName || 'Unknown'} | ${parts.join(' | ')}`;
    }).join('\n');

    const rfiEntries = rfis.map((r) => {
      return `RFI ${r.rfiNumber}: ${r.subject} | Status: ${r.status} | Priority: ${r.priority} | Due: ${r.dateDue ? r.dateDue.toISOString().split('T')[0] : 'N/A'} | Assigned: ${r.assignedTo || 'N/A'} | Ball in court: ${r.ballInCourt || 'N/A'}${r.question ? ` | Question: ${r.question}` : ''}`;
    }).join('\n');

    const submittalEntries = submittals.map((s) => {
      return `Submittal ${s.submittalNumber}: ${s.title} | Status: ${s.status} | Sub: ${s.subcontractor || 'N/A'} | Date: ${s.submittedDate ? s.submittedDate.toISOString().split('T')[0] : 'N/A'}`;
    }).join('\n');

    const systemPrompt = `You are a senior construction project manager writing an executive field report for the Owner of a luxury construction project (Ritz-Carlton / high-end residential style).

Analyze the daily logs, RFIs, and submittals from the reporting period and generate a structured JSON response with these exact keys:

{
  "overview": "2-3 paragraph executive narrative. Summarize the reporting period, key trades active, major decisions made, and any critical-path items. Write in a professional, confident tone suitable for an Owner who is not on site daily.",
  "milestones": [
    { "title": "Short headline (e.g., 'Sauna Power Allocation Resolved')", "bullets": ["2-4 sentences describing the milestone, decision, and impact"] }
  ],
  "openItems": [
    { "num": 1, "item": "Clear description of the open item / decision needed", "deadline": "This week / Month Year / Ongoing", "responsible": "Party responsible", "priority": "CRITICAL / HIGH / MEDIUM / LOW" }
  ],
  "actionItems": [
    { "num": 1, "action": "Specific action to be taken", "responsible": "Party responsible", "targetDate": "This week / Month Year / Ongoing / ASAP" }
  ]
}

Guidelines:
- Generate 3-6 milestones based on actual work, RFIs, and submittal activity.
- Mark items as CRITICAL if they are on the critical path or could delay the project.
- Action items should be concrete, assignable tasks — not vague observations.
- Use the Word document context (if provided) to enrich or override auto-detected items.
- Write in English unless the project context clearly indicates Spanish.
- Dates in the output should be natural language (e.g., "This week", "August 2026", "Ongoing").`;

    const userPrompt = `Project: ${project.projectName} (${project.projectNumber})
Client: ${project.client || 'Owner'}
Location: ${project.location || 'N/A'}
Reporting Period: ${from} to ${to}

--- DAILY LOGS ---
${logEntries || 'No daily logs in this period.'}

--- OPEN RFIs ---
${rfiEntries || 'No open RFIs.'}

--- SUBMITTALS THIS PERIOD ---
${submittalEntries || 'No submittal activity.'}

${wordContext ? `--- ADDITIONAL CONTEXT FROM OWNER DOCUMENT ---\n${wordContext}` : ''}

Generate the executive report JSON now.`;

    const aiResult = await askClaudeJSON<{
      overview: string;
      milestones: { title: string; bullets: string[] }[];
      openItems: { num: number; item: string; deadline: string; responsible: string; priority: string }[];
      actionItems: { num: number; action: string; responsible: string; targetDate: string }[];
    }>({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 4000,
    });

    return NextResponse.json({
      overview: aiResult.overview || '',
      milestones: Array.isArray(aiResult.milestones) ? aiResult.milestones : [],
      openItems: Array.isArray(aiResult.openItems) ? aiResult.openItems : [],
      actionItems: Array.isArray(aiResult.actionItems) ? aiResult.actionItems : [],
    });
  } catch (error: any) {
    console.error('AI analyze error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to analyze with AI' },
      { status: 500 }
    );
  }
}
