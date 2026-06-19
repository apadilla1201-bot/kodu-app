/**
 * lib/ai.ts — Módulo central de IA (Claude / Anthropic)
 * Reemplaza las llamadas a Abacus (apps.abacus.ai/v1/chat/completions).
 *
 * Por qué centralizado: antes la llamada a la IA estaba copiada en 12 rutas.
 * Ahora vive aquí. Si cambias de modelo o proveedor, cambias UN archivo.
 *
 * Requiere: ANTHROPIC_API_KEY en .env
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6'; // rápido y fuerte para narrativas técnicas

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Llamada simple (no streaming) — devuelve el texto completo.
 * Usar para: extracción de PDF, narrativas de COR/RFI, reportes.
 */
export async function askClaude(opts: {
  system?: string;
  messages: AIMessage[];
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 3000,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown');
    console.error('Claude API error:', err);
    throw new Error('AI request failed');
  }

  const data = await res.json();
  // Claude devuelve content como array de bloques; concatenar los de texto
  return (data?.content ?? [])
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b?.text ?? '')
    .join('');
}

/**
 * Devuelve JSON parseado del modelo. Limpia ```json fences por si acaso.
 * Usar para: market-analysis, extracción estructurada.
 */
export async function askClaudeJSON<T = any>(opts: {
  system?: string;
  messages: AIMessage[];
  maxTokens?: number;
}): Promise<T> {
  const raw = await askClaude(opts);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as T;
}

/**
 * Streaming SSE — para UIs que muestran progreso en vivo (market-analysis).
 * Devuelve un ReadableStream listo para new Response(stream, {...}).
 */
export async function streamClaude(opts: {
  system?: string;
  messages: AIMessage[];
  maxTokens?: number;
}): Promise<ReadableStream> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 3000,
      system: opts.system,
      messages: opts.messages,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error('AI stream failed');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let partial = '';

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          partial += decoder.decode(value, { stream: true });
          const lines = partial.split('\n');
          partial = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            try {
              const evt = JSON.parse(data);
              // Claude streaming: content_block_delta tiene el texto
              if (evt?.type === 'content_block_delta' && evt?.delta?.text) {
                buffer += evt.delta.text;
                const progress = JSON.stringify({ status: 'processing', message: 'Analyzing...' });
                controller.enqueue(encoder.encode(`data: ${progress}\n\n`));
              }
              if (evt?.type === 'message_stop') {
                try {
                  const clean = buffer.replace(/```json|```/g, '').trim();
                  const result = JSON.parse(clean);
                  const final = JSON.stringify({ status: 'completed', result });
                  controller.enqueue(encoder.encode(`data: ${final}\n\n`));
                } catch {
                  const e = JSON.stringify({ status: 'error', message: 'Parse failed' });
                  controller.enqueue(encoder.encode(`data: ${e}\n\n`));
                }
                controller.close();
                return;
              }
            } catch { /* skip non-JSON keepalives */ }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
