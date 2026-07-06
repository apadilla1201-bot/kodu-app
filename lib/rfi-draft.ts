/**
 * Draft RFI fields from superintendent field notes (voice transcript or text).
 */
import { askClaudeJSON } from '@/lib/ai';

export type RfiDraft = {
  subject: string;
  question: string;
  discipline: string;
  drawingReference: string | null;
  specReference: string | null;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
};

function heuristicDraft(text: string): RfiDraft {
  const t = text.trim();
  const firstLine = t.split(/\n/)[0]?.slice(0, 120) || 'Field clarification needed';
  return {
    subject: firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine,
    question: t,
    discipline: 'General',
    drawingReference: null,
    specReference: null,
    priority: /urgent|asap|immediate/i.test(t) ? 'Urgent' : /high priority/i.test(t) ? 'High' : 'Normal',
  };
}

export async function draftRfiFromFieldNote(
  note: string,
  context?: { projectName?: string; projectNumber?: string },
): Promise<RfiDraft> {
  const trimmed = note.trim();
  if (!trimmed) {
    throw new Error('Note text is required');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicDraft(trimmed);
  }

  try {
    const result = await askClaudeJSON<RfiDraft>({
      system: `You are a construction PM assistant. Convert superintendent field notes into a professional RFI draft. Return ONLY valid JSON with keys: subject (max 120 chars), question (detailed), discipline (one of Architectural, Structural, Mechanical, Electrical, Plumbing, Fire Protection, Civil, Landscape, Interior Design, General), drawingReference (string or null), specReference (string or null), priority (Low|Normal|High|Urgent).`,
      messages: [
        {
          role: 'user',
          content: `Project: ${context?.projectNumber ?? ''} ${context?.projectName ?? ''}\n\nField note:\n${trimmed}`,
        },
      ],
      maxTokens: 1500,
    });
    return {
      subject: String(result.subject || '').slice(0, 120) || heuristicDraft(trimmed).subject,
      question: String(result.question || trimmed),
      discipline: result.discipline || 'General',
      drawingReference: result.drawingReference ?? null,
      specReference: result.specReference ?? null,
      priority: ['Low', 'Normal', 'High', 'Urgent'].includes(result.priority)
        ? result.priority
        : 'Normal',
    };
  } catch {
    return heuristicDraft(trimmed);
  }
}
