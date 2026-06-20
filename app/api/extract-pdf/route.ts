export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const base64Buffer = await file.arrayBuffer();
    const base64String = Buffer.from(base64Buffer).toString('base64');

    // Use LLM API to extract text from PDF
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
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: file?.name ?? 'document.pdf',
                  file_data: `data:application/pdf;base64,${base64String}`,
                },
              },
              {
                type: 'text',
                text: `You are a construction cost estimator. Extract ALL text and financial data from this subcontractor quote/invoice/proposal PDF.

CRITICAL: You MUST extract the actual dollar amounts from the document. Look carefully for:
- Invoice totals, subtotals, line item prices, labor rates, material costs
- Numbers preceded by $ signs or in columns labeled Amount, Total, Price, Cost, Rate, etc.
- If the document has a single lump sum total, use that as the line item total
- If there are multiple items with individual prices, list each one

Return a JSON object with this EXACT structure:
{
  "fullText": "the complete extracted text from the PDF",
  "parsed": {
    "description": "brief summary of the scope of work being quoted",
    "subcontractor": "the company or person name providing the quote (just the name string)",
    "lineItems": [
      {
        "description": "description of work or material",
        "productCode": "product/item code if any, otherwise empty string",
        "quantity": 1,
        "unit": "LS or EA or SF or LF etc",
        "unitPrice": 5000.00,
        "total": 5000.00,
        "isMaterial": false
      }
    ]
  }
}

IMPORTANT RULES:
- unitPrice and total MUST be actual numbers from the document, NOT zero
- If only a lump sum total is given, set quantity=1, unit="LS", unitPrice=total amount, total=total amount
- isMaterial=true only for physical materials/supplies, false for labor/services
- subcontractor must be a plain string (company name only), not an object
- Respond with raw JSON only, no code blocks or markdown`,
              },
            ],
          },
        ],
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => 'Unknown error');
      console.error('[Extract PDF] LLM API error:', response.status, err);
      return NextResponse.json({ error: 'Failed to extract PDF content' }, { status: 500 });
    }

    const llmData = await response.json();
    const content = llmData?.choices?.[0]?.message?.content ?? '{}';
    console.log('[Extract PDF] LLM response length:', content?.length, 'preview:', content?.substring?.(0, 200));

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch (e: any) {
      console.error('[Extract PDF] JSON parse error:', e?.message, 'content preview:', content?.substring?.(0, 300));
      parsed = { fullText: content, parsed: null };
    }

    // Normalize subcontractor in case LLM returns an object
    if (parsed?.parsed?.subcontractor && typeof parsed.parsed.subcontractor !== 'string') {
      const sub = parsed.parsed.subcontractor;
      parsed.parsed.subcontractor = sub?.name ?? sub?.company ?? JSON.stringify(sub);
    }

    const items = parsed?.parsed?.lineItems ?? [];
    console.log('[Extract PDF] Success. Description:', parsed?.parsed?.description?.substring?.(0, 80), 'Sub:', parsed?.parsed?.subcontractor, 'Items:', items.length);
    if (items.length > 0) {
      console.log('[Extract PDF] Line items:', items.map((li: any) => `${li?.description?.substring?.(0, 30)}: qty=${li?.quantity} price=${li?.unitPrice} total=${li?.total}`).join(' | '));
    }

    return NextResponse.json({
      text: parsed?.fullText ?? content ?? '',
      parsed: parsed?.parsed ?? null,
    });
  } catch (error: any) {
    console.error('Extract PDF error:', error);
    return NextResponse.json({ error: 'Failed to extract PDF' }, { status: 500 });
  }
}
