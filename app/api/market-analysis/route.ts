export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { streamClaude } from '@/lib/ai';

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

    const market = location ?? 'Miami, FL';
    const stream = await streamClaude({
      system: `You are a construction cost estimator specializing in the ${market} market. You have access to RSMeans construction cost data, local market pricing, and industry databases. Provide realistic market price comparisons for construction materials and services.`,
      messages: [
        {
          role: 'user',
          content: `Analyze these construction line items and provide market price comparisons for ${market}:\n\n${itemsList}\n\nFor each item, provide:\n1. A realistic market average price based on RSMeans data and Miami-area pricing\n2. The variance percentage compared to the quoted price\n3. A brief assessment (e.g., "Competitive", "Above Market", "Below Market", "Fair")\n\nAlso provide overall notes about the market analysis.\n\nRespond with raw JSON only:\n{\n  "comparisons": [\n    {"itemDescription": "", "subQuote": 0, "marketAverage": 0, "variancePercent": 0, "assessment": "", "source": "RSMeans / Miami Market"}\n  ],\n  "notes": "Overall analysis notes..."\n}`,
        },
      ],
      maxTokens: 3000,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Market analysis error:', error);
    return new Response(JSON.stringify({ error: 'Market analysis failed' }), { status: 500 });
  }
}
