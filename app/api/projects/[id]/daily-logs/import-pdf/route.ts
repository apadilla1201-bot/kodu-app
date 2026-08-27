export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { askClaudeWithPdfJSON } from '@/lib/ai';

const DAILY_LOG_PARSE_PROMPT = `You are a construction data extraction assistant. Read this Daily Field Report PDF and extract all relevant information into a structured JSON object.

The PDF is a daily construction report from the field (superintendent/supervisor). It may come from apps like Fieldwire, Procore, Raken, or similar.

Extract these fields:
- logDate: The date of the report in ISO format (YYYY-MM-DD). Use the most specific date mentioned.
- authorName: The supervisor/superintendent name who prepared the report.
- authorEmail: If present, otherwise null.
- weather: Weather conditions (e.g., "Sunny", "Cloudy", "Rain", "Partly Cloudy"). If not mentioned, null.
- temperature: Temperature if mentioned (e.g., "85°F", "32°C"). If not mentioned, null.
- workPerformed: A detailed narrative of all work performed that day. Combine information from "Work Logs", "Supervisor Remarks", "Work Performed", or similar sections. Preserve paragraph breaks. Be thorough.
- crewNotes: Information about crew/workers present, toolbox talks, safety meetings, attendance. Combine "Toolbox Meetings", "Workers in attendance", "Manpower", "Crew" sections.
- deliveries: Any material deliveries, equipment deliveries, or drop-offs mentioned. If none, null.
- delays: Any delays, issues, problems, injuries, accidents, or obstacles encountered. Include "Hazards", "Issues", "Injuries/accidents", "Delays" sections. If none, null.
- equipment: Any equipment used or on site. If none, null.
- inspections: Any inspections performed or mentioned. If none, null.
- safetyNotes: Any safety-related notes from toolbox talks, hazards identified, or safety reminders. If none, null.
- hoursWorked: Work hours if mentioned (e.g., "7:00 AM - 5:00 PM"). If not mentioned, null.

RULES:
- If a field is not found in the PDF, use null (not empty string).
- Combine related sections intelligently. For example, merge "Supervisor Remarks" and "Work Logs" into workPerformed.
- Preserve the original language of the report (English or Spanish).
- For workPerformed, crewNotes, delays, deliveries: write complete, natural sentences. Do not just copy bullet points — synthesize into readable paragraphs.
- If the report has "No Response" or "None" in a section, treat it as null.

Return ONLY valid JSON in this exact structure:
{
  "logDate": "2026-08-26",
  "authorName": "William Ratcliff",
  "authorEmail": null,
  "weather": null,
  "temperature": null,
  "workPerformed": "...",
  "crewNotes": "...",
  "deliveries": null,
  "delays": null,
  "equipment": null,
  "inspections": null,
  "safetyNotes": null,
  "hoursWorked": null
}`;

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported for daily report import.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    const parsed = await askClaudeWithPdfJSON<{
      logDate: string | null;
      authorName: string | null;
      authorEmail: string | null;
      weather: string | null;
      temperature: string | null;
      workPerformed: string | null;
      crewNotes: string | null;
      deliveries: string | null;
      delays: string | null;
      equipment: string | null;
      inspections: string | null;
      safetyNotes: string | null;
      hoursWorked: string | null;
    }>({
      prompt: DAILY_LOG_PARSE_PROMPT,
      pdfBase64: base64,
      mediaType: 'application/pdf',
      maxTokens: 4000,
    });

    return NextResponse.json({
      extracted: {
        logDate: parsed.logDate ?? null,
        authorName: parsed.authorName ?? session.user?.name ?? 'Superintendent',
        authorEmail: parsed.authorEmail ?? (session.user?.email || null),
        weather: parsed.weather ?? null,
        temperature: parsed.temperature ?? null,
        workPerformed: parsed.workPerformed ?? null,
        crewNotes: parsed.crewNotes ?? null,
        deliveries: parsed.deliveries ?? null,
        delays: parsed.delays ?? null,
        equipment: parsed.equipment ?? null,
        inspections: parsed.inspections ?? null,
        safetyNotes: parsed.safetyNotes ?? null,
        hoursWorked: parsed.hoursWorked ?? null,
      },
    });
  } catch (error: any) {
    console.error('Import daily log PDF error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to import daily log from PDF' },
      { status: 500 },
    );
  }
}
