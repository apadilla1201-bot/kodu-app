export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

const LLM_URL = 'https://api.abacus.ai/v1/chat/completions';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = (formData.get('type') as string) || 'g703'; // 'g702' or 'g703'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'application/pdf';

    let prompt = '';
    if (type === 'g703') {
      prompt = `You are analyzing an AIA G703 Continuation Sheet (Schedule of Values) PDF.
Extract ALL line items from this document into a JSON array.

For each line item, extract:
- itemNumber: the item/trade number (e.g., "01000-01", "02000", "O&P", "GLI", "CONT")
- description: description of work
- subVendor: subcontractor or vendor name
- scheduledValue: scheduled/original value (number)
- budgetRealloc: budget reallocation amount (number, usually 0)
- previousChanges: previous change order amounts (number)
- currentChanges: current period change amounts (number)
- previousCompleted: work completed in previous periods (number)
- thisCompleted: work completed this period (number)
- retainage: retainage amount (number)
- isSection: true if this is a SECTION HEADER (bold text, typically all caps, no dollar values), false for regular line items
- isFee: true if this is an O&P, GL Insurance, or Contingency fee line
- isBelowLine: true if marked as "below the line" or pass-through

IMPORTANT:
- Extract EVERY row, including section headers, subtotals, and fee lines
- Dollar amounts should be numbers, not strings
- Section headers (isSection=true) have no dollar values
- O&P, GLI, CONT are fee lines (isFee=true)
- Order items exactly as they appear in the document

Return ONLY a valid JSON object with this structure:
{"lineItems": [...], "totalScheduledValue": number, "totalCompleted": number}`;
    } else {
      prompt = `You are analyzing an AIA G702 Application and Certificate for Payment PDF.
Extract the following information into a JSON object:

- ownerName: name of the Owner (TO field)
- ownerAddress: owner's address
- ownerCity: owner's city/state/zip
- architectName: name of the Architect
- architectAddress: architect's address
- architectCity: architect's city/state/zip
- contractDate: contract date (ISO format YYYY-MM-DD)
- contractFor: project/contract description
- contractForm: contract form type (e.g., "AIA A102")
- applicationNumber: pay application number
- applicationDate: date of application (ISO format)
- periodFrom: billing period start (ISO format)
- periodTo: billing period end (ISO format)
- originalContractSum: Line 1 original contract sum (number)
- netChangeByOrders: Line 2 net change (number)
- constructionSubtotal: construction subtotal if shown (number)
- opPercent: overhead & profit percentage (decimal, e.g., 0.08 for 8%)
- glPercent: general liability percentage (decimal)
- contingencyPercent: contingency percentage (decimal)
- retainagePercent: retainage percentage (decimal)
- glInsuranceAmount: GL insurance flat amount if shown (number)
- advancePayments: Line 7a advance/interim payments (number)
- advancePaymentsLabel: label for advance payments
- directPayments: Line 7b direct payments (number)
- directPaymentsLabel: label for direct payments
- previousCertificates: Line 7 previous certificates (number)
- contractorPrinted: contractor's printed name
- contractorTitle: contractor's title

Return ONLY a valid JSON object. Use null for missing fields. Percentages as decimals (8% = 0.08).`;
    }

    const llmResponse = await fetch(LLM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        max_tokens: 16000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'file',
                file: {
                  filename: file.name,
                  content: base64,
                  content_type: mimeType,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      console.error('LLM API error:', llmResponse.status, errText);
      return NextResponse.json({ error: 'Failed to process PDF with AI' }, { status: 500 });
    }

    const llmData = await llmResponse.json();
    const content = llmData?.choices?.[0]?.message?.content ?? '';

    // Extract JSON from response
    let parsed: any = null;
    try {
      // Try to find JSON in code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      // Try to find any JSON object in the response
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try {
          parsed = JSON.parse(objMatch[0]);
        } catch {
          return NextResponse.json({ error: 'Failed to parse AI response', raw: content.substring(0, 500) }, { status: 500 });
        }
      }
    }

    if (!parsed) {
      return NextResponse.json({ error: 'No data extracted from PDF' }, { status: 500 });
    }

    if (type === 'g703') {
      // Format line items with sortOrder
      const items = (parsed.lineItems ?? []).map((li: any, idx: number) => ({
        sortOrder: idx + 1,
        itemNumber: String(li.itemNumber ?? ''),
        description: String(li.description ?? ''),
        subVendor: String(li.subVendor ?? li.sub ?? ''),
        scheduledValue: Number(li.scheduledValue ?? 0),
        budgetRealloc: Number(li.budgetRealloc ?? 0),
        previousChanges: Number(li.previousChanges ?? 0),
        currentChanges: Number(li.currentChanges ?? 0),
        previousCompleted: Number(li.previousCompleted ?? 0),
        thisCompleted: Number(li.thisCompleted ?? 0),
        retainage: Number(li.retainage ?? 0),
        isSection: Boolean(li.isSection),
        isBelowLine: Boolean(li.isBelowLine),
        isFee: Boolean(li.isFee),
        sectionCode: String(li.sectionCode ?? li.itemNumber?.split('-')?.[0] ?? ''),
        sectionTitle: li.isSection ? String(li.description ?? '') : '',
      }));

      console.log(`PDF G703 import: ${items.length} line items extracted`);
      return NextResponse.json({ success: true, type: 'g703', lineItems: items });
    } else {
      console.log('PDF G702 import: header data extracted', Object.keys(parsed).length, 'fields');
      return NextResponse.json({ success: true, type: 'g702', headerData: parsed });
    }
  } catch (error: any) {
    console.error('Pay App PDF import error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process PDF' }, { status: 500 });
  }
}
