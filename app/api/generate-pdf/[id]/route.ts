export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PDFDocument } from 'pdf-lib';
import { downloadFileBuffer } from '@/lib/s3';

function esc(str: string): string {
  return (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtDateLong(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any)?.id ?? '';

    const cor = await prisma.changeOrder.findUnique({
      where: { id: params?.id ?? '' },
      include: {
        project: true,
        lineItems: true,
        marketComparisons: true,
      },
    });

    if (!cor || cor?.project?.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const logoUrl = `${baseUrl}/pdg_logo.png`;
    const supplierTotal = (cor?.subtotal ?? 0) + (cor?.salesTax ?? 0);
    const dateStr = fmtDate(cor?.date);
    const dateLong = fmtDateLong(cor?.date);
    const corNum = cor?.corNumber ?? '';
    const projectName = cor?.project?.projectName ?? '';
    const client = cor?.project?.client ?? '';
    const location = cor?.project?.location ?? '';
    const subcontractor = cor?.subcontractor ?? '';

    // ═══════════════════════════════════════════════════════════════
    // PAGE 1-2: CHANGE ORDER JUSTIFICATION (Word doc format)
    // ═══════════════════════════════════════════════════════════════

    const lineItemsTableHtml = (cor?.lineItems ?? []).map((li: any, i: number) => `
      <tr>
        <td style="padding:5px 6px;border:1px solid #ddd;text-align:center;width:28px;">${i + 1}</td>
        <td style="padding:5px 6px;border:1px solid #ddd;font-family:monospace;font-size:9px;">${esc(li?.productCode ?? '')}</td>
        <td style="padding:5px 6px;border:1px solid #ddd;font-size:10px;">${esc(li?.description ?? '')}</td>
        <td style="padding:5px 6px;border:1px solid #ddd;text-align:center;white-space:nowrap;">${li?.quantity ?? 0} ${esc(li?.unit ?? '')}</td>
        <td style="padding:5px 6px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(li?.unitPrice ?? 0)}</td>
        <td style="padding:5px 6px;border:1px solid #ddd;text-align:right;font-family:monospace;font-weight:600;">${fmt(li?.total ?? 0)}</td>
      </tr>
    `).join('');

    const marketRows = (cor?.marketComparisons ?? []).map((mc: any) => `
      <tr>
        <td style="padding:5px 8px;border:1px solid #ddd;">${esc(mc?.itemDescription ?? '')}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;">${mc?.marketLow && mc?.marketHigh ? `${fmt(mc.marketLow)} – ${fmt(mc.marketHigh)}` : fmt(mc?.marketAverage ?? 0)}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-family:monospace;">${fmt(mc?.subQuote ?? 0)}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-weight:600;">${esc(mc?.assessment ?? '')}</td>
      </tr>
    `).join('');

    const hasMarket = (cor?.marketComparisons ?? []).length > 0;
    const hasLineItems = (cor?.lineItems ?? []).length > 0;
    const numLineItems = (cor?.lineItems ?? []).length;

    const justificationHtml = `
<!-- ═══ PAGES 1-2: JUSTIFICATION ═══ -->
<div class="page justification">
  <!-- Top bar -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <span style="font-weight:700;font-size:11px;color:#333;">Arena Madness &nbsp;|&nbsp; COR ${esc(corNum)}</span>
    <span style="font-size:11px;color:#666;">${dateStr}</span>
  </div>

  <!-- Title banner -->
  <div style="background:#C9A96E;padding:10px 16px;text-align:center;margin-bottom:16px;">
    <span style="font-weight:700;font-size:14px;color:#fff;letter-spacing:0.5px;">ARENA MADNESS – CHANGE ORDER JUSTIFICATION &nbsp;│&nbsp; COR ${esc(corNum)}</span>
  </div>

  <!-- Metadata table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:11px;">
    <tr>
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;width:80px;background:#f8f8f8;">Project:</td>
      <td style="padding:5px 8px;border:1px solid #ddd;">${esc(projectName)}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;width:90px;background:#f8f8f8;">COR #:</td>
      <td style="padding:5px 8px;border:1px solid #ddd;">${esc(corNum)}</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;background:#f8f8f8;">Date:</td>
      <td style="padding:5px 8px;border:1px solid #ddd;">${dateLong}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;background:#f8f8f8;">PM:</td>
      <td style="padding:5px 8px;border:1px solid #ddd;">Augusto Padilla</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;background:#f8f8f8;">GC:</td>
      <td style="padding:5px 8px;border:1px solid #ddd;">The Project Delivery Group, LLC</td>
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;background:#f8f8f8;">Subcontractor:</td>
      <td style="padding:5px 8px;border:1px solid #ddd;">${esc(subcontractor)}</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;background:#f8f8f8;">Location:</td>
      <td style="padding:5px 8px;border:1px solid #ddd;">${esc(location)}</td>
      <td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;background:#f8f8f8;">Sub Proposal:</td>
      <td style="padding:5px 8px;border:1px solid #ddd;">${esc(cor?.notes ?? '')}</td>
    </tr>
  </table>

  <!-- 1. REASON FOR CHANGE -->
  <div class="section-header">1. REASON FOR CHANGE</div>
  <div style="margin:8px 0 16px 0;font-size:11px;line-height:1.6;white-space:pre-wrap;">${esc(cor?.reasonForChange ?? cor?.description ?? '')}</div>

  <!-- 2. SUPPLIER QUOTATION BREAKDOWN -->
  ${hasLineItems ? `
  <div class="section-header">2. SUPPLIER QUOTATION BREAKDOWN</div>
  <table style="width:100%;border-collapse:collapse;margin:8px 0 4px 0;font-size:10px;">
    <thead>
      <tr style="background:#666;color:#fff;">
        <th style="padding:5px 6px;border:1px solid #ddd;text-align:center;">Ln</th>
        <th style="padding:5px 6px;border:1px solid #ddd;text-align:left;">Product Code</th>
        <th style="padding:5px 6px;border:1px solid #ddd;text-align:left;">Description</th>
        <th style="padding:5px 6px;border:1px solid #ddd;text-align:center;">Qty</th>
        <th style="padding:5px 6px;border:1px solid #ddd;text-align:right;">Unit Price</th>
        <th style="padding:5px 6px;border:1px solid #ddd;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsTableHtml}
      <tr style="font-weight:700;background:#f5f5f5;">
        <td colspan="5" style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Material Subtotal (${numLineItems} line items)</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.subtotal ?? 0)}</td>
      </tr>
      ${(cor?.salesTax ?? 0) > 0 ? `
      <tr>
        <td colspan="5" style="padding:5px 8px;border:1px solid #ddd;text-align:right;">Florida Sales Tax @ 7.00%</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.salesTax ?? 0)}</td>
      </tr>
      <tr style="font-weight:700;background:#f5f5f5;">
        <td colspan="5" style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Supplier Total (Supply Only)</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(supplierTotal)}</td>
      </tr>
      ` : ''}
    </tbody>
  </table>
  ` : `
  <div class="section-header">2. DESCRIPTION OF ADDITIONAL WORK</div>
  <table style="width:100%;border-collapse:collapse;margin:8px 0 16px 0;font-size:11px;">
    <thead>
      <tr style="background:#666;color:#fff;">
        <th style="padding:5px 8px;border:1px solid #ddd;width:30px;text-align:center;">#</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:left;">Description of Work</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:left;">Notes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;">1</td>
        <td style="padding:5px 8px;border:1px solid #ddd;">${esc(cor?.description ?? '')}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;font-style:italic;color:#666;">${esc(cor?.reasonsParticular ?? '')}</td>
      </tr>
    </tbody>
  </table>
  `}

  <!-- 3. COST SUMMARY -->
  <div class="section-header">3. COST SUMMARY</div>
  <table style="width:100%;border-collapse:collapse;margin:8px 0 16px 0;font-size:11px;">
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;">Subcontractor Cost — ${esc(subcontractor)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;font-family:monospace;width:120px;">${fmt(supplierTotal > 0 ? supplierTotal : (cor?.subtotal ?? 0))}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;">PDG Margin @ 6%</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.overheadProfit ?? 0)}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px;border:1px solid #ddd;">Insurance @ 1.5%</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.generalLiability ?? 0)}</td>
    </tr>
    <tr style="background:#f5f5f5;font-weight:700;font-size:12px;">
      <td style="padding:8px 10px;border:1px solid #ddd;">TOTAL — COR ${esc(corNum)}</td>
      <td style="padding:8px 10px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.totalAmount ?? 0)}</td>
    </tr>
  </table>

  <!-- 4. MIAMI MARKET PRICE ANALYSIS -->
  ${hasMarket ? `
  <div class="section-header">4. MIAMI MARKET PRICE ANALYSIS</div>
  <p style="font-size:10px;color:#555;margin:6px 0 8px 0;">The following comparison confirms that the subcontractor's proposal is consistent with prevailing Miami-Dade market rates.</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px;">
    <thead>
      <tr style="background:#666;color:#fff;">
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:left;">Item</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:left;">Miami Market Range</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:left;">${esc(subcontractor || 'Quote')}</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:left;">Assessment</th>
      </tr>
    </thead>
    <tbody>${marketRows}</tbody>
  </table>
  ${cor?.marketAnalysisNotes ? `<p style="font-size:10px;color:#666;margin-top:4px;"><em>${esc(cor.marketAnalysisNotes)}</em></p>` : ''}
  ` : ''}

  <!-- 5. SUPPORTING DOCUMENTS -->
  <div class="section-header">5. SUPPORTING DOCUMENTS</div>
  <table style="width:100%;border-collapse:collapse;margin:8px 0 16px 0;font-size:11px;">
    <thead>
      <tr style="background:#666;color:#fff;">
        <th style="padding:5px 8px;border:1px solid #ddd;width:30px;text-align:center;">#</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:left;">Document</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:left;">Description</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;">1</td>
        <td style="padding:5px 8px;border:1px solid #ddd;">${esc(subcontractor)} — Proposal/Invoice</td>
        <td style="padding:5px 8px;border:1px solid #ddd;">Subcontractor proposal for ${fmt(supplierTotal > 0 ? supplierTotal : (cor?.subtotal ?? 0))}. Scope: ${esc(cor?.description ?? '')}</td>
      </tr>
      <tr>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;">2</td>
        <td style="padding:5px 8px;border:1px solid #ddd;">PDG COR ${esc(corNum)} (${dateStr})</td>
        <td style="padding:5px 8px;border:1px solid #ddd;">Formal Change Order Request with PDG margin applied. Total to Owner per this COR.</td>
      </tr>
    </tbody>
  </table>

  <!-- 6. APPROVAL -->
  <div class="section-header">6. APPROVAL</div>
  <p style="font-size:11px;margin:8px 0 16px 0;">Prepared by: Augusto Padilla — Project Manager, PDG Construction</p>
  <table style="width:100%;font-size:11px;">
    <tr>
      <td style="width:48%;">
        <div style="background:#666;color:#fff;padding:5px 10px;font-weight:700;font-size:10px;margin-bottom:12px;">Augusto Padilla &nbsp;│&nbsp; Project Manager — PDG</div>
        <p style="margin:4px 0;">Signature: _______________________</p>
        <p style="margin:4px 0;">Printed: _________________________</p>
        <p style="margin:4px 0;">Date: ____________________________</p>
      </td>
      <td style="width:4%;"></td>
      <td style="width:48%;">
        <div style="background:#666;color:#fff;padding:5px 10px;font-weight:700;font-size:10px;margin-bottom:12px;">Owner &nbsp;│&nbsp; ${esc(client || projectName)}</div>
        <p style="margin:4px 0;">Signature: _______________________</p>
        <p style="margin:4px 0;">Printed: _________________________</p>
        <p style="margin:4px 0;">Date: ____________________________</p>
      </td>
    </tr>
  </table>
</div>
`;

    // ═══════════════════════════════════════════════════════════════
    // PAGE 3: CHANGE ORDER REQUEST (Excel format - formal COR sheet)
    // ═══════════════════════════════════════════════════════════════

    const corRequestHtml = `
<div class="page-break"></div>
<div class="page cor-request">
  <!-- Header with logo and COR number -->
  <table style="width:100%;margin-bottom:2px;">
    <tr>
      <td style="width:60%;">
        <span style="font-size:16px;font-weight:700;color:#0F1B33;letter-spacing:0.5px;">THE PROJECT DELIVERY GROUP, LLC</span>
      </td>
      <td style="width:40%;text-align:right;">
        <span style="font-size:32px;font-weight:700;color:#C9A96E;font-style:italic;">${esc(corNum)}</span>
      </td>
    </tr>
  </table>
  <div style="font-size:9px;color:#666;margin-bottom:4px;">7255 NE 4th Ave., Unit 110-2 &middot; Miami, FL 33138 &middot; (772) 766-9399 &middot; www.projectdeliverygroup.com</div>
  <div style="height:3px;background:linear-gradient(90deg,#C9A96E,#C9A96E 60%,transparent);margin-bottom:12px;"></div>

  <!-- Title -->
  <div style="background:#0F1B33;padding:8px 16px;text-align:center;margin-bottom:14px;">
    <span style="font-weight:700;font-size:13px;color:#fff;letter-spacing:1px;">CHANGE ORDER REQUEST — ${esc(projectName.toUpperCase())}</span>
  </div>

  <!-- Project info grid -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px;">
    <tr>
      <td style="padding:4px 8px;text-align:right;font-weight:700;font-size:9px;color:#666;width:70px;">PROJECT:</td>
      <td style="padding:4px 8px;font-weight:700;">${esc(projectName)}</td>
      <td style="padding:4px 8px;text-align:right;font-weight:700;font-size:9px;color:#666;width:80px;">COR #:</td>
      <td style="padding:4px 8px;">${esc(corNum)}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;text-align:right;font-weight:700;font-size:9px;color:#666;">OWNER:</td>
      <td style="padding:4px 8px;">${esc(client)}</td>
      <td style="padding:4px 8px;text-align:right;font-weight:700;font-size:9px;color:#666;">DATE:</td>
      <td style="padding:4px 8px;">${dateStr}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;text-align:right;font-weight:700;font-size:9px;color:#666;">GC:</td>
      <td style="padding:4px 8px;font-weight:700;">The Project Delivery Group, LLC</td>
      <td style="padding:4px 8px;text-align:right;font-weight:700;font-size:9px;color:#666;">PM:</td>
      <td style="padding:4px 8px;">Augusto Padilla</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;text-align:right;font-weight:700;font-size:9px;color:#666;">ADDRESS:</td>
      <td style="padding:4px 8px;">${esc(location)}</td>
      <td style="padding:4px 8px;text-align:right;font-weight:700;font-size:9px;color:#666;">APPROVED:</td>
      <td style="padding:4px 8px;">${esc(cor?.status ?? 'Pending')}</td>
    </tr>
  </table>

  <!-- Status bar -->
  <div style="background:${cor?.status === 'Approved' ? '#2E7D32' : cor?.status === 'Rejected' ? '#92400E' : '#C9A96E'};padding:6px;text-align:center;margin-bottom:14px;">
    <span style="font-weight:700;font-size:11px;color:#fff;letter-spacing:1px;">STATUS: &nbsp;${esc((cor?.status ?? 'PENDING').toUpperCase())}</span>
  </div>

  <!-- Scope / Description -->
  <div style="background:#0F1B33;padding:5px 10px;margin-bottom:8px;">
    <span style="font-weight:700;font-size:10px;color:#fff;">SCOPE / DESCRIPTION OF WORK</span>
  </div>
  <div style="padding:8px 10px;font-size:11px;line-height:1.5;margin-bottom:14px;border:1px solid #eee;">${esc(cor?.description ?? '')}</div>

  <!-- Cost Breakdown -->
  <div style="background:#0F1B33;padding:5px 10px;margin-bottom:8px;">
    <span style="font-weight:700;font-size:10px;color:#fff;">COST BREAKDOWN</span>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:left;">DESCRIPTION OF WORK</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:center;width:40px;">QTY</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:center;width:40px;">UNIT</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:right;width:80px;">UNIT COST</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:right;width:80px;">SUBTOTAL</th>
        <th style="padding:5px 8px;border:1px solid #ddd;text-align:right;width:80px;">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${hasLineItems ? (cor?.lineItems ?? []).map((li: any) => `
        <tr>
          <td style="padding:5px 8px;border:1px solid #ddd;">${esc(li?.description ?? '')}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;">${li?.quantity ?? 1}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;">${esc(li?.unit ?? 'LS')}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(li?.unitPrice ?? 0)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(li?.total ?? 0)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(li?.total ?? 0)}</td>
        </tr>
      `).join('') : `
        <tr>
          <td style="padding:5px 8px;border:1px solid #ddd;">${esc(cor?.description ?? '')}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;">1</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center;">LS</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.subtotal ?? 0)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.subtotal ?? 0)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.subtotal ?? 0)}</td>
        </tr>
      `}
      <!-- Subtotals -->
      <tr style="background:#f9f9f9;">
        <td colspan="4" style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:600;">Subcontractor Total</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(supplierTotal > 0 ? supplierTotal : (cor?.subtotal ?? 0))}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(supplierTotal > 0 ? supplierTotal : (cor?.subtotal ?? 0))}</td>
      </tr>
      <tr>
        <td colspan="4" style="padding:5px 8px;border:1px solid #ddd;text-align:right;">PDG Overhead &amp; Profit @ 6%</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.overheadProfit ?? 0)}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.overheadProfit ?? 0)}</td>
      </tr>
      <tr>
        <td colspan="4" style="padding:5px 8px;border:1px solid #ddd;text-align:right;">General Liability Insurance @ 1.5%</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.generalLiability ?? 0)}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-family:monospace;">${fmt(cor?.generalLiability ?? 0)}</td>
      </tr>
      <!-- Grand Total -->
      <tr style="background:#FEF3C7;font-weight:700;font-size:12px;">
        <td colspan="4" style="padding:8px;border:2px solid #C9A96E;text-align:right;">TOTAL — ${esc(corNum)}</td>
        <td style="padding:8px;border:2px solid #C9A96E;text-align:right;font-family:monospace;background:#C9A96E;color:#fff;">${fmt(cor?.totalAmount ?? 0)}</td>
        <td style="padding:8px;border:2px solid #C9A96E;text-align:right;font-family:monospace;background:#C9A96E;color:#fff;">${fmt(cor?.totalAmount ?? 0)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Approval section -->
  <div style="background:#0F1B33;padding:5px 10px;margin-bottom:10px;">
    <span style="font-weight:700;font-size:10px;color:#fff;">APPROVAL</span>
  </div>
  <table style="width:100%;font-size:10px;border-collapse:collapse;">
    <tr>
      <td style="width:33%;vertical-align:top;">
        <p style="font-weight:700;text-decoration:underline;margin:0 0 2px 0;">SUBCONTRACTOR</p>
        <p style="font-style:italic;margin:0 0 10px 0;">Authorized Representative</p>
        <p style="margin:4px 0;">Signature: ___________________</p>
        <p style="margin:4px 0;">Printed: _____________________</p>
        <p style="margin:4px 0;">Date: ________________________</p>
      </td>
      <td style="width:33%;vertical-align:top;">
        <p style="font-weight:700;text-decoration:underline;margin:0 0 2px 0;">GC — PDG</p>
        <p style="font-style:italic;margin:0 0 10px 0;">Augusto Padilla, PM</p>
        <p style="margin:4px 0;">Signature: ___________________</p>
        <p style="margin:4px 0;">Printed: _____________________</p>
        <p style="margin:4px 0;">Date: ________________________</p>
      </td>
      <td style="width:33%;vertical-align:top;">
        <p style="font-weight:700;text-decoration:underline;margin:0 0 2px 0;">OWNER / ${esc((client || projectName).toUpperCase())}</p>
        <p style="font-style:italic;margin:0 0 10px 0;">&nbsp;</p>
        <p style="margin:4px 0;">Signature: ___________________</p>
        <p style="margin:4px 0;">Printed: _____________________</p>
        <p style="margin:4px 0;">Date: ________________________</p>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <div style="margin-top:16px;text-align:right;font-size:8px;color:#999;">The Project Delivery Group, LLC &middot; ${esc(projectName)} &middot; © Kodu GC</div>
</div>
`;

    // ═══════════════════════════════════════════════════════════════
    // FULL HTML DOCUMENT
    // ═══════════════════════════════════════════════════════════════

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 15mm 12mm; size: letter; }
    body { font-family: Arial, Helvetica, sans-serif; color: #333; font-size: 11px; line-height: 1.4; margin: 0; padding: 0; }
    .page-break { page-break-before: always; }
    .section-header { background: #666; color: #fff; padding: 5px 10px; font-weight: 700; font-size: 11px; margin: 14px 0 6px 0; }
    table { border-spacing: 0; }
  </style>
</head>
<body>
${justificationHtml}
${corRequestHtml}
</body>
</html>
`;

    // Generate PDF via HTML2PDF API
    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: htmlContent,
        pdf_options: {
          format: 'Letter',
          margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
          print_background: true,
        },
        base_url: baseUrl,
      }),
    });

    if (!createResponse.ok) {
      const err = await createResponse.json().catch(() => ({}));
      console.error('PDF create error:', err);
      return NextResponse.json({ error: 'Failed to initiate PDF generation' }, { status: 500 });
    }

    const { request_id } = await createResponse.json();
    if (!request_id) {
      return NextResponse.json({ error: 'No request ID returned' }, { status: 500 });
    }

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 120;
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      });
      const statusResult = await statusResponse.json();
      const status = statusResult?.status ?? 'FAILED';
      const result = statusResult?.result ?? null;

      if (status === 'SUCCESS') {
        if (result?.result) {
          let finalPdfBytes: Uint8Array;
          const generatedPdfBytes = Buffer.from(result.result, 'base64');

          // Merge subcontractor PDF as last pages if available
          if (cor?.subPdfCloudPath) {
            try {
              console.log('Downloading sub PDF from:', cor.subPdfCloudPath);
              const subPdfBuffer = await downloadFileBuffer(cor.subPdfCloudPath);
              
              const mergedPdf = await PDFDocument.create();
              
              // Copy generated COR pages
              const corDoc = await PDFDocument.load(generatedPdfBytes);
              const corPages = await mergedPdf.copyPages(corDoc, corDoc.getPageIndices());
              corPages.forEach(page => mergedPdf.addPage(page));
              
              // Copy subcontractor PDF pages at the end
              const subDoc = await PDFDocument.load(subPdfBuffer);
              const subPages = await mergedPdf.copyPages(subDoc, subDoc.getPageIndices());
              subPages.forEach(page => mergedPdf.addPage(page));
              
              finalPdfBytes = await mergedPdf.save();
              console.log(`Merged PDF: ${corPages.length} COR pages + ${subPages.length} sub pages`);
            } catch (mergeErr: any) {
              console.error('Failed to merge sub PDF, returning COR-only PDF:', mergeErr?.message);
              finalPdfBytes = generatedPdfBytes;
            }
          } else {
            finalPdfBytes = generatedPdfBytes;
          }

          // Sanitize filename for Safari compatibility
          const safeCorNum = (corNum ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
          const safeDesc = (cor?.description ?? '').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_').substring(0, 30);
          const filename = `COR_${safeCorNum}${safeDesc ? '_' + safeDesc : ''}.pdf`;
          return new NextResponse(Buffer.from(finalPdfBytes), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': String(finalPdfBytes.length),
            },
          });
        }
        return NextResponse.json({ error: 'PDF generated but no data' }, { status: 500 });
      } else if (status === 'FAILED') {
        return NextResponse.json({ error: result?.error ?? 'PDF generation failed' }, { status: 500 });
      }
      attempts++;
    }

    return NextResponse.json({ error: 'PDF generation timed out' }, { status: 500 });
  } catch (error: any) {
    console.error('Generate PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
