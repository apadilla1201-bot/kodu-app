export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PDFDocument } from 'pdf-lib';

function esc(str: string): string {
  return (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v < 0) return `(${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtD(n: number | null | undefined): string {
  return `$${fmt(n)}`;
}

function fmtPct(n: number | null | undefined): string {
  const v = (n ?? 0) * 100;
  return v === 0 ? '0%' : `${v.toFixed(1)}%`;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtDateLong(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface LineItem {
  sortOrder: number;
  itemNumber: string;
  description: string;
  subVendor: string;
  scheduledValue: number;
  budgetRealloc: number;
  previousChanges: number;
  currentChanges: number;
  previousCompleted: number;
  thisCompleted: number;
  retainage: number;
  isSection: boolean;
  isBelowLine: boolean;
  isFee: boolean;
  sectionCode: string;
  sectionTitle: string;
}

function buildG702Html(pa: any, project: any, lines: LineItem[]): string {
  // Compute G702 values from line items
  const regularLines = lines.filter((l: LineItem) => !l.isSection && !l.isBelowLine && !l.isFee);
  const feeLines = lines.filter((l: LineItem) => l.isFee);
  const opLine = feeLines.find((l: LineItem) => l.itemNumber === 'O&P');
  const gliLine = feeLines.find((l: LineItem) => l.itemNumber === 'GLI');
  const contLine = feeLines.find((l: LineItem) => l.itemNumber === 'CONT');

  const constructionSubtotal = pa.constructionSubtotal || regularLines.reduce((s: number, l: LineItem) => s + (l.scheduledValue || 0), 0);
  const opAmount = opLine?.scheduledValue || constructionSubtotal * (pa.opPercent || 0);
  const gliAmount = pa.glInsuranceAmount || gliLine?.scheduledValue || 0;
  const contAmount = contLine?.scheduledValue || constructionSubtotal * (pa.contingencyPercent || 0);
  const originalContractSum = pa.originalContractSum || (constructionSubtotal + opAmount + gliAmount + contAmount);

  // Calculated values from G703 line items (fallback)
  const calcChanges = lines.filter((l: LineItem) => !l.isSection).reduce((s: number, l: LineItem) => s + (l.previousChanges || 0) + (l.currentChanges || 0), 0);
  const calcCompleted = lines.filter((l: LineItem) => !l.isSection).reduce((s: number, l: LineItem) => s + (l.previousCompleted || 0) + (l.thisCompleted || 0), 0);
  const calcRetainage = lines.filter((l: LineItem) => !l.isSection).reduce((s: number, l: LineItem) => s + (l.retainage || 0), 0);
  const retainagePercent = pa.retainagePercent || 0.10;

  // Use G702 fixed values from Excel when available, otherwise fall back to calculated
  const allChanges = (pa as any).g702NetChange ?? calcChanges;
  const contractSumToDate = (pa as any).g702ContractSumToDate ?? (originalContractSum + allChanges);
  const totalCompleted = (pa as any).g702TotalCompleted ?? calcCompleted;
  const computedRetainage = (pa as any).g702Retainage ?? (calcRetainage || (totalCompleted * retainagePercent));
  const totalEarned = (pa as any).g702TotalEarned ?? (totalCompleted - computedRetainage);

  const advPay = pa.advancePayments || 0;
  const directPayDeduction = (pa as any).directPaymentsDeduction || pa.directPayments || 0;
  const directPayTotal = pa.directPayments || 0;
  const prevCert = pa.previousCertificates || 0;

  // Line 8: use G702 fixed value or calculate
  const currentPayment = (pa as any).g702CurrentPaymentDue ?? (totalEarned - prevCert - advPay - directPayDeduction);
  // Line 9: use G702 fixed value or calculate
  const balanceToFinish = (pa as any).g702BalanceToFinish ?? (contractSumToDate - totalEarned);

  const pctComplete = contractSumToDate > 0 ? ((totalCompleted / contractSumToDate) * 100).toFixed(1) : '0.0';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: letter; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.3; }
  .page { width: 100%; max-width: 7.5in; margin: 0 auto; }
  .header { background: #0F1B33; color: white; padding: 12px 16px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left h1 { font-size: 14pt; font-weight: bold; margin-bottom: 2px; }
  .header-left p { font-size: 8pt; opacity: 0.85; }
  .header-right { text-align: right; font-size: 8pt; }
  .header-right .app-no { font-size: 18pt; font-weight: bold; color: #C9A96E; }
  .gold-bar { background: #C9A96E; color: #0F1B33; padding: 6px 16px; font-size: 8pt; display: flex; justify-content: space-between; font-weight: 600; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #ccc; margin-top: 8px; }
  .info-cell { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; font-size: 8.5pt; }
  .info-cell.right { border-left: 1px solid #e0e0e0; }
  .info-label { font-weight: 600; color: #555; font-size: 7.5pt; text-transform: uppercase; margin-bottom: 1px; }
  .section-title { background: #0F1B33; color: white; padding: 6px 10px; font-weight: bold; font-size: 9pt; margin-top: 12px; }
  .fin-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .fin-table td { padding: 4px 10px; border-bottom: 1px solid #e8e8e8; font-size: 8.5pt; }
  .fin-table .line-num { width: 30px; font-weight: bold; color: #0F1B33; }
  .fin-table .line-label { }
  .fin-table .line-val { text-align: right; font-weight: 600; width: 130px; }
  .fin-table tr.highlight { background: #FFF8E7; }
  .fin-table tr.total { background: #0F1B33; color: white; font-weight: bold; }
  .fin-table tr.total td { padding: 6px 10px; border: none; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .sig-block { border: 1px solid #ccc; padding: 10px; }
  .sig-block h3 { font-size: 9pt; font-weight: bold; color: #0F1B33; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; margin-bottom: 6px; }
  .sig-line { border-bottom: 1px solid #333; height: 24px; margin: 8px 0 2px; }
  .sig-label { font-size: 7pt; color: #777; }
  .deduction-row td { font-size: 8pt; color: #666; padding-left: 30px !important; }
  .footer { text-align: center; font-size: 7pt; color: #999; margin-top: 16px; padding-top: 8px; border-top: 1px solid #e0e0e0; }
</style>
</head><body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>APPLICATION AND CERTIFICATE FOR PAYMENT</h1>
      <p>AIA Document G702 — PDG Construction Group, Inc.</p>
    </div>
    <div class="header-right">
      <div class="app-no">PA #${pa.applicationNumber}</div>
      <div>Application Date: ${fmtDate(pa.applicationDate)}</div>
      <div>Period: ${fmtDate(pa.periodFrom)} to ${fmtDate(pa.periodTo)}</div>
    </div>
  </div>
  <div class="gold-bar">
    <span>PDG Construction Group, Inc. — 4360 NW 128th St, Opa-locka, FL 33054</span>
    <span>License: CGC1530498</span>
  </div>

  <div class="info-grid">
    <div class="info-cell"><div class="info-label">TO (Owner)</div>${esc(pa.ownerName || '')}<br/>${esc(pa.ownerAddress || '')}<br/>${esc(pa.ownerCity || '')}</div>
    <div class="info-cell right"><div class="info-label">FROM (Contractor)</div>PDG Construction Group, Inc.<br/>Attn: ${esc(pa.contractorPrinted || 'Pedro Dominguez')}<br/>4360 NW 128th St, Opa-locka, FL 33054</div>
    <div class="info-cell"><div class="info-label">Project</div>${esc(pa.contractFor || project?.projectName || '')}</div>
    <div class="info-cell right"><div class="info-label">Architect</div>${esc(pa.architectName || '')}<br/>${esc(pa.architectAddress || '')}<br/>${esc(pa.architectCity || '')}</div>
    <div class="info-cell"><div class="info-label">Contract Date</div>${fmtDate(pa.contractDate)}</div>
    <div class="info-cell right"><div class="info-label">Contract For</div>${esc(pa.contractForm || '')}</div>
  </div>

  <div class="two-col">
    <div>
      <div class="section-title">APPLICATION FOR PAYMENT</div>
      <table class="fin-table">
        <tr><td class="line-num">1.</td><td class="line-label">ORIGINAL CONTRACT SUM</td><td class="line-val">${fmtD(originalContractSum)}</td></tr>
        <tr><td class="line-num">2.</td><td class="line-label">Net Change by Change Orders</td><td class="line-val">${fmtD(allChanges)}</td></tr>
        <tr><td class="line-num">3.</td><td class="line-label">CONTRACT SUM TO DATE (Line 1 ± 2)</td><td class="line-val">${fmtD(contractSumToDate)}</td></tr>
        <tr class="highlight"><td class="line-num">4.</td><td class="line-label">TOTAL COMPLETED & STORED TO DATE</td><td class="line-val">${fmtD(totalCompleted)}</td></tr>
        <tr><td class="line-num">5.</td><td class="line-label">RETAINAGE (${fmtPct(retainagePercent)})</td><td class="line-val">${fmtD(computedRetainage)}</td></tr>
        <tr><td class="line-num">6.</td><td class="line-label">TOTAL EARNED LESS RETAINAGE (4 − 5)</td><td class="line-val">${fmtD(totalEarned)}</td></tr>
        <tr><td class="line-num">7.</td><td class="line-label">LESS PREVIOUS CERTIFICATES FOR PAYMENT</td><td class="line-val">${fmtD(prevCert)}</td></tr>
        ${advPay ? `<tr class="deduction-row"><td></td><td>7a. Advance Payments${pa.advancePaymentsLabel ? ` (${esc(pa.advancePaymentsLabel)})` : ''}</td><td class="line-val" style="font-size:8pt;">${fmtD(advPay)}</td></tr>` : ''}
        ${directPayDeduction ? `<tr class="deduction-row"><td></td><td>7b. Direct Payments${pa.directPaymentsLabel ? ` (${esc(pa.directPaymentsLabel)})` : ''}</td><td class="line-val" style="font-size:8pt;">${fmtD(directPayDeduction)}</td></tr>` : (directPayTotal ? `<tr class="deduction-row"><td></td><td>7b. Direct Payments${pa.directPaymentsLabel ? ` (${esc(pa.directPaymentsLabel)})` : ''}</td><td class="line-val" style="font-size:8pt;">${fmtD(directPayTotal)}</td></tr>` : '')}
        <tr class="total"><td class="line-num">8.</td><td class="line-label">CURRENT PAYMENT DUE</td><td class="line-val">${fmtD(currentPayment)}</td></tr>
        <tr><td class="line-num">9.</td><td class="line-label">BALANCE TO FINISH, INCLUDING RETAINAGE</td><td class="line-val">${fmtD(balanceToFinish)}</td></tr>
      </table>

      <div style="margin-top:8px; padding:6px 10px; background:#f8f9fa; border:1px solid #e0e0e0; font-size:8pt;">
        <strong>Completion:</strong> ${pctComplete}% &nbsp;|&nbsp; <strong>Retainage held:</strong> ${fmtD(computedRetainage)}
      </div>
    </div>

    <div>
      <div class="section-title">CERTIFICATE FOR PAYMENT</div>
      <div style="padding:10px; border:1px solid #ccc; border-top:none; font-size:8pt; min-height:200px;">
        <p style="margin-bottom:8px;">In accordance with the Contract Documents, based on on-site observations and the data comprising the above application, the Architect certifies to the Owner that to the best of the Architect's knowledge, information and belief, the Work has progressed as indicated, the quality of the Work is in accordance with the Contract Documents, and the Contractor is entitled to payment of the <strong>AMOUNT CERTIFIED</strong>.</p>
        <div style="text-align:center; margin:16px 0;">
          <div style="font-size:11pt; font-weight:bold; color:#0F1B33;">AMOUNT CERTIFIED: ${fmtD(currentPayment)}</div>
        </div>
        <div class="sig-line"></div>
        <div class="sig-label">ARCHITECT (Signature) &nbsp;&nbsp;&nbsp; Date:</div>
      </div>
    </div>
  </div>

  <div class="two-col" style="margin-top:12px;">
    <div class="sig-block">
      <h3>CONTRACTOR</h3>
      <div class="sig-line"></div>
      <div class="sig-label">Signature</div>
      <div style="margin-top:4px; font-size:8pt;"><strong>${esc(pa.contractorPrinted || '')}</strong><br/>${esc(pa.contractorTitle || '')}</div>
      <div style="margin-top:4px;"><span class="sig-label">Date: </span>_________________</div>
      <div style="margin-top:2px;"><span class="sig-label">Notarized: </span>State of Florida, County of Miami-Dade</div>
    </div>
    <div class="sig-block">
      <h3>OWNER</h3>
      <div class="sig-line"></div>
      <div class="sig-label">Signature</div>
      <div style="margin-top:4px; font-size:8pt;"><strong>${esc(pa.ownerPrinted || pa.ownerName || '')}</strong></div>
      <div style="margin-top:4px;"><span class="sig-label">Date: </span>_________________</div>
    </div>
  </div>

  <div class="footer">
    PDG Construction Group, Inc. &bull; ${esc(project?.projectNumber || '')} — ${esc(project?.projectName || '')} &bull; PA #${pa.applicationNumber} &bull; Generated ${new Date().toLocaleDateString('en-US')}
  </div>
</div>
</body></html>`;
}

function buildG703Html(pa: any, project: any, lines: LineItem[]): string {
  const regularLines = lines.filter((l: LineItem) => !l.isFee && !l.isBelowLine);
  const feeLines = lines.filter((l: LineItem) => l.isFee);
  const belowLines = lines.filter((l: LineItem) => l.isBelowLine && !l.isSection);

  // Compute subtotals for regular (non-fee, non-below) items
  const nonSectionRegular = regularLines.filter((l: LineItem) => !l.isSection);
  const subScheduled = nonSectionRegular.reduce((s: number, l: LineItem) => s + (l.scheduledValue || 0), 0);
  const subRealloc = nonSectionRegular.reduce((s: number, l: LineItem) => s + (l.budgetRealloc || 0), 0);
  const subPrevChanges = nonSectionRegular.reduce((s: number, l: LineItem) => s + (l.previousChanges || 0), 0);
  const subCurrChanges = nonSectionRegular.reduce((s: number, l: LineItem) => s + (l.currentChanges || 0), 0);
  const subRevised = subScheduled + subRealloc + subPrevChanges + subCurrChanges;
  const subPrevCompl = nonSectionRegular.reduce((s: number, l: LineItem) => s + (l.previousCompleted || 0), 0);
  const subThisCompl = nonSectionRegular.reduce((s: number, l: LineItem) => s + (l.thisCompleted || 0), 0);
  const subTotalCompl = subPrevCompl + subThisCompl;
  const subPctCompl = subRevised > 0 ? ((subTotalCompl / subRevised) * 100).toFixed(1) : '0.0';
  const subBalance = subRevised - subTotalCompl;
  const subRetainage = nonSectionRegular.reduce((s: number, l: LineItem) => s + (l.retainage || 0), 0);

  // Grand totals including fees
  const allNonSection = lines.filter((l: LineItem) => !l.isSection);
  const grandScheduled = allNonSection.reduce((s: number, l: LineItem) => s + (l.scheduledValue || 0), 0);
  const grandRealloc = allNonSection.reduce((s: number, l: LineItem) => s + (l.budgetRealloc || 0), 0);
  const grandPrevChanges = allNonSection.reduce((s: number, l: LineItem) => s + (l.previousChanges || 0), 0);
  const grandCurrChanges = allNonSection.reduce((s: number, l: LineItem) => s + (l.currentChanges || 0), 0);
  const grandRevised = grandScheduled + grandRealloc + grandPrevChanges + grandCurrChanges;
  const grandPrevCompl = allNonSection.reduce((s: number, l: LineItem) => s + (l.previousCompleted || 0), 0);
  const grandThisCompl = allNonSection.reduce((s: number, l: LineItem) => s + (l.thisCompleted || 0), 0);
  const grandTotalCompl = grandPrevCompl + grandThisCompl;
  const grandPctCompl = grandRevised > 0 ? ((grandTotalCompl / grandRevised) * 100).toFixed(1) : '0.0';
  const grandBalance = grandRevised - grandTotalCompl;
  const grandRetainage = allNonSection.reduce((s: number, l: LineItem) => s + (l.retainage || 0), 0);

  function renderRow(l: LineItem, idx: number): string {
    if (l.isSection) {
      return `<tr class="section-row">
        <td>${esc(l.itemNumber)}</td>
        <td colspan="13" class="section-desc">${esc(l.description)}</td>
      </tr>`;
    }
    const revised = (l.scheduledValue || 0) + (l.budgetRealloc || 0) + (l.previousChanges || 0) + (l.currentChanges || 0);
    const totalCompl = (l.previousCompleted || 0) + (l.thisCompleted || 0);
    const pctCompl = revised > 0 ? ((totalCompl / revised) * 100).toFixed(1) : '0.0';
    const balance = revised - totalCompl;
    const rowClass = idx % 2 === 0 ? 'even-row' : 'odd-row';
    return `<tr class="${rowClass}">
      <td class="item-col">${esc(l.itemNumber)}</td>
      <td class="desc-col">${esc(l.description)}</td>
      <td class="sub-col">${esc(l.subVendor)}</td>
      <td class="num-col">${fmt(l.scheduledValue)}</td>
      <td class="num-col">${fmt(l.budgetRealloc)}</td>
      <td class="num-col">${fmt(l.previousChanges)}</td>
      <td class="num-col">${fmt(l.currentChanges)}</td>
      <td class="num-col" style="font-weight:600;">${fmt(revised)}</td>
      <td class="num-col">${fmt(l.previousCompleted)}</td>
      <td class="num-col this-period">${fmt(l.thisCompleted)}</td>
      <td class="num-col" style="font-weight:600;">${fmt(totalCompl)}</td>
      <td class="pct-col">${pctCompl}%</td>
      <td class="num-col">${fmt(balance)}</td>
      <td class="num-col">${fmt(l.retainage)}</td>
    </tr>`;
  }

  function renderSubtotalRow(label: string, sched: number, realloc: number, prevCh: number, currCh: number, revised: number, prevC: number, thisC: number, totalC: number, pct: string, bal: number, ret: number, cls: string = 'subtotal-row'): string {
    return `<tr class="${cls}">
      <td></td>
      <td class="desc-col" style="font-weight:bold;">${label}</td>
      <td></td>
      <td class="num-col">${fmt(sched)}</td>
      <td class="num-col">${fmt(realloc)}</td>
      <td class="num-col">${fmt(prevCh)}</td>
      <td class="num-col">${fmt(currCh)}</td>
      <td class="num-col">${fmt(revised)}</td>
      <td class="num-col">${fmt(prevC)}</td>
      <td class="num-col this-period">${fmt(thisC)}</td>
      <td class="num-col">${fmt(totalC)}</td>
      <td class="pct-col">${pct}%</td>
      <td class="num-col">${fmt(bal)}</td>
      <td class="num-col">${fmt(ret)}</td>
    </tr>`;
  }

  let dataIdx = 0;
  const regularRows = regularLines.map(l => {
    const row = renderRow(l, l.isSection ? 0 : dataIdx);
    if (!l.isSection) dataIdx++;
    return row;
  }).join('\n');

  const feeRows = feeLines.map((l, i) => {
    // Fee section headers are in the lines array as isSection rows
    return renderRow(l, i);
  }).join('\n');

  // Fee section headers
  const feeSectionHeaders = lines.filter((l: LineItem) => l.isSection && (l.sectionTitle?.includes('OVERHEAD') || l.sectionTitle?.includes('LIABILITY') || l.sectionTitle?.includes('CONTINGENCY') || l.sectionCode === 'O&P' || l.sectionCode === 'GLI' || l.sectionCode === 'CONT'));
  const feeAndHeaderLines = lines.filter((l: LineItem) => l.isFee || feeSectionHeaders.includes(l));
  let feeIdx = 0;
  const feeFullRows = feeAndHeaderLines.map(l => {
    const row = renderRow(l, l.isSection ? 0 : feeIdx);
    if (!l.isSection) feeIdx++;
    return row;
  }).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: letter landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; color: #1a1a1a; line-height: 1.2; }
  .page { width: 100%; }
  .header { background: #0F1B33; color: white; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 11pt; font-weight: bold; }
  .header .sub { font-size: 7.5pt; opacity: 0.85; }
  .header .right { text-align: right; font-size: 7.5pt; }
  .header .app-no { font-size: 14pt; font-weight: bold; color: #C9A96E; }
  .gold-bar { background: #C9A96E; color: #0F1B33; padding: 4px 12px; font-size: 7pt; font-weight: 600; display: flex; justify-content: space-between; }
  table.g703 { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.g703 th { background: #0F1B33; color: white; padding: 4px 5px; font-size: 6.5pt; text-align: center; font-weight: 600; border: 1px solid #0F1B33; white-space: nowrap; }
  table.g703 td { padding: 2px 4px; border: 1px solid #e0e0e0; font-size: 7pt; }
  .item-col { width: 55px; text-align: center; }
  .desc-col { min-width: 140px; }
  .sub-col { width: 80px; font-size: 6.5pt; }
  .num-col { text-align: right; width: 72px; font-variant-numeric: tabular-nums; }
  .pct-col { text-align: center; width: 38px; }
  .even-row { background: #ffffff; }
  .odd-row { background: #F2F4F7; }
  .section-row { background: #E8EAF0; }
  .section-row td { font-weight: bold; font-size: 7pt; padding: 3px 5px; }
  .section-desc { font-weight: bold; }
  .this-period { background: rgba(201,169,110,0.12); }
  .subtotal-row { background: #E8EAF0; font-weight: bold; }
  .subtotal-row td { border-top: 2px solid #0F1B33; padding: 3px 4px; }
  .grand-row { background: #0F1B33; color: white; font-weight: bold; }
  .grand-row td { padding: 4px 5px; border: 1px solid #0F1B33; }
  .fee-section { margin-top: 2px; }
  .footer { text-align: center; font-size: 6.5pt; color: #999; margin-top: 8px; }
</style>
</head><body>
<div class="page">
  <div class="header">
    <div>
      <h1>CONTINUATION SHEET — AIA G703</h1>
      <div class="sub">PDG Construction Group, Inc. — ${esc(project?.projectNumber || '')} ${esc(project?.projectName || '')}</div>
    </div>
    <div class="right">
      <div class="app-no">PA #${pa.applicationNumber}</div>
      <div>Period: ${fmtDate(pa.periodFrom)} to ${fmtDate(pa.periodTo)}</div>
    </div>
  </div>
  <div class="gold-bar">
    <span>Application Date: ${fmtDate(pa.applicationDate)}</span>
    <span>Contract: ${esc(pa.contractFor || project?.projectName || '')}</span>
  </div>

  <table class="g703">
    <thead>
      <tr>
        <th>ITEM #</th>
        <th>DESCRIPTION OF WORK</th>
        <th>SUB / VENDOR</th>
        <th>SCHEDULED<br/>VALUE</th>
        <th>BUDGET<br/>REALLOC</th>
        <th>PREV<br/>CHANGES</th>
        <th>CURRENT<br/>CHANGES</th>
        <th>REVISED<br/>SCH VALUE</th>
        <th>PREV<br/>COMPLETED</th>
        <th style="background:#8B7340;">THIS<br/>PERIOD</th>
        <th>TOTAL<br/>COMPLETED</th>
        <th>%</th>
        <th>BALANCE<br/>TO FINISH</th>
        <th>RETAINAGE</th>
      </tr>
    </thead>
    <tbody>
      ${regularRows}
      ${renderSubtotalRow('CONSTRUCTION SUBTOTAL', subScheduled, subRealloc, subPrevChanges, subCurrChanges, subRevised, subPrevCompl, subThisCompl, subTotalCompl, subPctCompl, subBalance, subRetainage)}
      ${feeFullRows}
      ${renderSubtotalRow('GRAND TOTAL', grandScheduled, grandRealloc, grandPrevChanges, grandCurrChanges, grandRevised, grandPrevCompl, grandThisCompl, grandTotalCompl, grandPctCompl, grandBalance, grandRetainage, 'grand-row')}
    </tbody>
  </table>

  <div class="footer">
    PDG Construction Group, Inc. &bull; PA #${pa.applicationNumber} &bull; ${esc(project?.projectNumber || '')} ${esc(project?.projectName || '')} &bull; Generated ${new Date().toLocaleDateString('en-US')}
  </div>
</div>
</body></html>`;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'both'; // 'g702', 'g703', or 'both'

    const pa = await prisma.payApplication.findUnique({
      where: { id: params?.id ?? '' },
      include: {
        project: true,
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!pa) {
      return NextResponse.json({ error: 'Pay application not found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const lines: LineItem[] = pa.lineItems.map((li: any) => ({
      sortOrder: li.sortOrder,
      itemNumber: li.itemNumber || '',
      description: li.description || '',
      subVendor: li.subVendor || '',
      scheduledValue: li.scheduledValue || 0,
      budgetRealloc: li.budgetRealloc || 0,
      previousChanges: li.previousChanges || 0,
      currentChanges: li.currentChanges || 0,
      previousCompleted: li.previousCompleted || 0,
      thisCompleted: li.thisCompleted || 0,
      retainage: li.retainage || 0,
      isSection: li.isSection || false,
      isBelowLine: li.isBelowLine || false,
      isFee: li.isFee || false,
      sectionCode: li.sectionCode || '',
      sectionTitle: li.sectionTitle || '',
    }));

    const htmlPages: string[] = [];
    if (type === 'g702' || type === 'both') {
      htmlPages.push(buildG702Html(pa, pa.project, lines));
    }
    if (type === 'g703' || type === 'both') {
      htmlPages.push(buildG703Html(pa, pa.project, lines));
    }

    // Generate PDFs
    const pdfBuffers: Buffer[] = [];
    for (const html of htmlPages) {
      const isLandscape = html.includes('landscape');
      const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          html_content: html,
          pdf_options: {
            format: 'Letter',
            landscape: isLandscape,
            margin: isLandscape
              ? { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' }
              : { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
            print_background: true,
          },
          base_url: baseUrl,
        }),
      });

      if (!createResponse.ok) {
        console.error('PDF create error:', await createResponse.text());
        return NextResponse.json({ error: 'Failed to initiate PDF generation' }, { status: 500 });
      }

      const { request_id } = await createResponse.json();
      if (!request_id) {
        return NextResponse.json({ error: 'No request ID returned' }, { status: 500 });
      }

      // Poll for completion
      let attempts = 0;
      let pdfGenerated = false;
      while (attempts < 120) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
        });
        const statusResult = await statusResponse.json();
        const status = statusResult?.status ?? 'FAILED';
        const result = statusResult?.result ?? null;

        if (status === 'SUCCESS' && result?.result) {
          pdfBuffers.push(Buffer.from(result.result, 'base64'));
          pdfGenerated = true;
          break;
        } else if (status === 'FAILED') {
          return NextResponse.json({ error: result?.error ?? 'PDF generation failed' }, { status: 500 });
        }
        attempts++;
      }
      if (!pdfGenerated) {
        return NextResponse.json({ error: 'PDF generation timed out' }, { status: 500 });
      }
    }

    // Merge if multiple pages
    let finalPdf: Uint8Array;
    if (pdfBuffers.length === 1) {
      finalPdf = pdfBuffers[0];
    } else {
      const mergedDoc = await PDFDocument.create();
      for (const buf of pdfBuffers) {
        const doc = await PDFDocument.load(buf);
        const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => mergedDoc.addPage(p));
      }
      finalPdf = await mergedDoc.save();
    }

    const projectNum = pa.project?.projectNumber || '';
    const filename = `PayApp_${projectNum}_PA${pa.applicationNumber}_${type.toUpperCase()}.pdf`;

    return new NextResponse(Buffer.from(finalPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Pay App PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
