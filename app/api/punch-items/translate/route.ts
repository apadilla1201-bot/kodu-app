export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { askClaude } from '@/lib/ai';

/**
 * Traduce notas de campo (punch) a inglés profesional.
 * Regla de producto: el super/PM puede dictar o escribir en español,
 * pero el ítem —y por tanto el reporte— SIEMPRE se guarda en inglés.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const translated = await askClaude({
      system: [
        'You are a construction punch-list translator for a US general contractor.',
        'Translate the field note into concise, professional American English suitable for a formal construction punch list report.',
        'Rules:',
        '- Keep measurements, room/area numbers, grid lines, proper nouns and material names exactly as given.',
        '- Use standard US construction terminology (e.g. "drywall", "baseboard", "paint touch-up", "caulk joint").',
        '- Return ONLY the translated note: no quotes, no preamble, no explanation.',
        '- If the note is already in English, return it unchanged (you may lightly clean up grammar).',
      ].join('\n'),
      messages: [{ role: 'user', content: text.slice(0, 2000) }],
      maxTokens: 400,
    });

    const en = (translated ?? '').trim();
    if (!en) {
      return NextResponse.json({ error: 'Translation failed' }, { status: 502 });
    }
    return NextResponse.json({ en });
  } catch (error) {
    console.error('Punch translate error:', error);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
