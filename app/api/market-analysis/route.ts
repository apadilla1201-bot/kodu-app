export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await request.json();
    const { lineItems, location } = body ?? {};
    const safeItems = lineItems ?? [];

    if (safeItems?.length === 0) {
      return new Response(JSON.stringify({ error: 'No items provided' }), { status: 400 });
    }

    const itemsList = safeItems.map((li: any, i: number) =>
      `${i + 1}. ${li?.description ?? 'Unknown'} - Quoted at $${(li?.unitPrice ?? 0)?.toFixed?.(2)} per unit, qty: ${li?.quantity ?? 1}, total: $${(li?.total ?? 0)?.toFixed?.(2)}`
    ).join('\n');

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: [
          {
            role: 'system',
            content: `You are a construction cost estimator specializing in the ${location ?? 'Miami, FL'} market. You have access to RSMeans construction cost data, local market pricing, and industry databases. Provide realistic market price comparisons for construction materials and services.`,
          },
          {
            role: 'user',
            content: `Analyze these construction line items and provide market price comparisons for ${location ?? 'Miami, FL'}:\n\n${itemsList}\n\nFor each item, provide:\n1. A realistic market average price based on RSMeans data and Miami-area pricing\n2. The variance percentage compared to the quoted price\n3. A brief assessment (e.g., "Competitive", "Above Market", "Below Market", "Fair")\n\nAlso provide overall notes about the market analysis.\n\nRespond with raw JSON only:\n{\n  "comparisons": [\n    {"itemDescription": "", "subQuote": 0, "marketAverage": 0, "variancePercent": 0, "assessment": "", "source": "RSMeans / Miami Market"}\n  ],\n  "notes": "Overall analysis notes..."\n}`,
          },
        ],
        max_tokens: 3000,
        stream: true,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => 'Unknown');
      console.error('Market analysis LLM error:', err);
      return new Response(JSON.stringify({ error: 'Market analysis failed' }), { status: 500 });
    }

    const reader = response?.body?.getReader?.();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    let buffer = '';
    let partialRead = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (!reader) {
            controller.close();
            return;
          }
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            partialRead += decoder.decode(value, { stream: true });
            const lines = partialRead.split('\n');
            partialRead = lines?.pop?.() ?? '';
            for (const line of lines) {
              if (line?.startsWith?.('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  try {
                    const finalResult = JSON.parse(buffer);
                    const finalData = JSON.stringify({ status: 'completed', result: finalResult });
                    controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                  } catch (e: any) {
                    const errorData = JSON.stringify({ status: 'error', message: 'Failed to parse market data' });
                    controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                  }
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  buffer += parsed?.choices?.[0]?.delta?.content ?? '';
                  const progressData = JSON.stringify({ status: 'processing', message: 'Analyzing market prices...' });
                  controller.enqueue(encoder.encode(`data: ${progressData}\n\n`));
                } catch (e: any) { /* skip */ }
              }
            }
          }
          // If we get here without [DONE], try to parse what we have
          if (buffer) {
            try {
              const finalResult = JSON.parse(buffer);
              const finalData = JSON.stringify({ status: 'completed', result: finalResult });
              controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
            } catch (e: any) { /* skip */ }
          }
          controller.close();
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Market analysis error:', error);
    return new Response(JSON.stringify({ error: 'Market analysis failed' }), { status: 500 });
  }
}
