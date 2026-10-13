export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { computeProjectedCashflow } from '@/lib/projected-cashflow';
import { htmlToPdf } from '@/lib/pdf';
import { appBaseUrl } from '@/lib/app-url';
import { getPdfBrand } from '@/lib/company-brand';

/* ── Formatters ────────────────────────────────────────── */
const esc = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtBig = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')) : d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * POST /api/projects/[id]/projected-cashflow-pdf
 * Exporta el cash flow proyectado al fin de la obra en formato ejecutivo para owner.
 * Body: { mode: 'cpm'|'manual', rows: [{ label, amount }], manualPct?: string }
 * Los totales/divisions/CPM se calculan en servidor (fuente autoritativa);
 * las filas mensuales vienen del cliente para reflejar los supuestos manuales del PM.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';
    const brand = await getPdfBrand(companyId, appBaseUrl(), 38);

    const body = await request.json().catch(() => ({}));
    const mode = body.mode === 'cpm' ? 'cpm' : 'manual';
    const manualPct = typeof body.manualPct === 'string' ? body.manualPct : '';

    const data = await computeProjectedCashflow(params.id, companyId);
    if (!data.project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const project = data.project;
    if (!data.hasData) return NextResponse.json({ error: 'No data' }, { status: 400 });

    // Filas mensuales: CPM desde el servidor; manual desde el cliente (sanitizadas)
    let rows: { label: string; amount: number; cum: number }[];
    if (mode === 'cpm' && data.cpm?.available && data.cpm.months?.length > 0) {
      let c = 0;
      rows = data.cpm.months.slice(0, 72).map((m: any) => {
        const amount = Number.isFinite(m.amount) ? Math.max(0, m.amount) : 0;
        c += amount;
        return { label: String(m.label), amount, cum: c };
      });
    } else {
      const clientRows = Array.isArray(body.rows) ? body.rows : [];
      let c = 0;
      rows = clientRows.slice(0, 72).map((r: any) => {
        const amount = Number.isFinite(r?.amount) ? Math.max(0, r.amount) : 0;
        c += amount;
        return { label: String(r?.label ?? ''), amount, cum: c };
      });
    }

    const { totals, divisions, cpm, latestPaNumber } = data;
    const leftAtEnd = totals.revised - totals.executed - (rows.length > 0 ? rows[rows.length - 1].cum : 0);
    const pctExecuted = totals.revised > 0 ? (totals.executed / totals.revised) * 100 : 0;

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const todayShort = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Base de la proyección (texto para el subtítulo y notas)
    const basisText =
      mode === 'cpm' && cpm?.available
        ? `CPM ${cpm.revision} — DATA DATE ${fmtDate(cpm.dataDate).toUpperCase()}`
        : manualPct
          ? `PM ASSUMPTIONS — ${manualPct}% AVERAGE MONTHLY BURN ON REMAINING WORK`
          : 'PM ASSUMPTIONS — MANUAL PROJECTION';

    const noteLines: string[] = [];
    noteLines.push(`Basis: latest Pay Application${latestPaNumber != null ? ` #${latestPaNumber}` : ''} + Approved Change Orders only. Pending / rejected CORs are excluded.`);
    if (mode === 'cpm' && cpm?.available) {
      noteLines.push(
        cpm.fallbackDistributed
          ? `CPM ${cpm.revision} has no costs loaded on activities; the real remaining to execute (${fmt$(cpm.distributedAmount ?? cpm.remainingCost)}) was distributed evenly across pending activities by remaining time.`
          : `Projection follows CPM ${cpm.revision} activity dates and loaded costs (${cpm.costedActivities}/${cpm.totalActivities} activities with cost).`
      );
    } else {
      noteLines.push('Projection is based on Project Manager assumptions (monthly burn percentages), not on CPM activity dates.');
    }
    if (leftAtEnd > 1) {
      noteLines.push(`At the projected end date, ${fmt$(leftAtEnd)} of the remaining work would still be unprojected — extend the horizon or increase the monthly burn.`);
    }

    /* ── HTML — estilo ejecutivo (misma identidad del Owner Executive Cashflow) ── */
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #F5F3EF; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 11in; height: 8.5in; position: relative; overflow: hidden; page-break-after: always; background: #F5F3EF; }
  .page:last-child { page-break-after: auto; }

  .hdr { background: #0F1B33; padding: 14px 50px 12px; display: flex; justify-content: space-between; align-items: flex-start; }
  .hdr-eyebrow { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #C9A96E; font-weight: 600; }
  .hdr-eyebrow span { color: rgba(255,255,255,0.4); }
  .hdr-project { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 800; color: #C9A96E; margin-top: 2px; letter-spacing: -0.3px; }
  .hdr-right { text-align: right; color: rgba(255,255,255,0.5); font-size: 8.5px; line-height: 1.5; }
  .gold-line { height: 3px; background: linear-gradient(90deg, #C9A96E 0%, #B8975D 60%, rgba(201,169,110,0.15) 100%); }

  .body { padding: 20px 50px 0; }
  .sec-title { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 800; color: #0F1B33; line-height: 1.15; letter-spacing: -0.5px; }
  .sec-title-bar { width: 4px; background: #C9A96E; border-radius: 2px; margin-right: 16px; align-self: stretch; }
  .sec-title-wrap { display: flex; align-items: stretch; margin-bottom: 6px; }
  .sec-subtitle { font-size: 10px; text-transform: uppercase; letter-spacing: 2.5px; color: #999; font-weight: 600; margin-bottom: 2px; }
  .sec-desc { font-size: 10.5px; color: #666; line-height: 1.55; max-width: 680px; margin-bottom: 14px; }

  .kpi-row { display: flex; gap: 14px; margin-bottom: 14px; }
  .kpi-card { flex: 1; background: #fff; border: 1px solid #e8e5e0; border-radius: 8px; padding: 13px 16px; position: relative; }
  .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 8px 8px 0 0; }
  .kpi-card.gold::before { background: #C9A96E; } .kpi-card.blue::before { background: #3B82F6; }
  .kpi-card.amber::before { background: #D97706; } .kpi-card.green::before { background: #10B981; }
  .kpi-val { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 800; color: #0F1B33; line-height: 1.1; }
  .kpi-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1.8px; color: #999; font-weight: 700; margin-top: 6px; }
  .kpi-note { font-size: 9px; color: #888; margin-top: 6px; }
  .kpi-note strong { color: #C9A96E; font-weight: 700; }

  .ftr { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 50px; font-size: 7.5px; color: #aaa; letter-spacing: 0.5px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; }

  .p2-hdr { background: #0F1B33; padding: 8px 50px; }
  .p2-hdr-text { font-family: 'Playfair Display', serif; font-size: 11px; color: rgba(255,255,255,0.65); letter-spacing: 0.3px; }
  .p2-body { padding: 14px 50px 0; }
  .slabel { font-size: 8px; text-transform: uppercase; letter-spacing: 2.2px; color: #999; font-weight: 700; margin-bottom: 8px; }

  .ft { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .ft thead th { font-size: 8px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #0F1B33; background: #fff; }
  .ft thead th.gold { color: #C9A96E; } .ft thead th.dim { color: #888; }
  .ft tbody td { padding: 5px 10px; font-size: 10px; border-bottom: 1px solid #e8e5e0; }
  .ft td.r { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .ft td.dim { color: #888; }
  .ft tr.total td { border-top: 2px solid #0F1B33; border-bottom: none; font-weight: 800; background: #fff; }

  .note-box { background: #fff; border: 1px solid #e8e5e0; border-radius: 6px; padding: 10px 14px; position: relative; overflow: hidden; }
  .note-box::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #C9A96E; }
  .note-text { font-size: 9.5px; color: #333; line-height: 1.6; padding-left: 8px; }
  .note-text strong { font-weight: 700; color: #0F1B33; }
  .note-text .gold { color: #C9A96E; font-weight: 700; }
</style>
</head>
<body>

<!-- ════════════════ PAGE 1 ════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <div style="margin-bottom:8px;">${brand.logoHtml}</div>
      <div class="hdr-eyebrow">OWNER EXECUTIVE CASH FLOW <span>|</span> ${todayStr.toUpperCase()} <span>|</span> CONFIDENTIAL</div>
      <div class="hdr-project">${esc(project.projectName.toUpperCase())}</div>
    </div>
    <div class="hdr-right">
      ${esc(project.client ?? 'Owner')} | Project #${esc(project.projectNumber)}${project.location ? ` | ${esc(project.location)}` : ''}
    </div>
  </div>
  <div class="gold-line"></div>

  <div class="body">
    <div class="sec-title-wrap">
      <div class="sec-title-bar"></div>
      <div>
        <div class="sec-title">PROJECTED CASH FLOW — END OF CONSTRUCTION</div>
        <div class="sec-subtitle">${esc(basisText)}</div>
      </div>
    </div>
    <div class="sec-desc">
      Monthly funding projection from today through the end of construction for ${esc(project.projectName)} — the owner's forward capital deployment schedule, based on the current contract value, work executed to date and the ${mode === 'cpm' ? 'active CPM schedule' : 'project manager\'s burn assumptions'}.
    </div>

    <div class="kpi-row">
      <div class="kpi-card gold">
        <div class="kpi-val">${fmtBig(totals.revised)}</div>
        <div class="kpi-label">REVISED CONTRACT VALUE</div>
        <div class="kpi-note">Budget + approved CORs${latestPaNumber != null ? ` per PA #${latestPaNumber}` : ''}</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-val">${fmtBig(totals.executed)}</div>
        <div class="kpi-label">EXECUTED TO DATE</div>
        <div class="kpi-note"><strong>${fmtPct(pctExecuted)}</strong> of revised value</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-val">${fmtBig(totals.remaining)}</div>
        <div class="kpi-label">REMAINING TO EXECUTE</div>
        <div class="kpi-note">Forward funding requirement</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-val">${cpm?.finishDate ? fmtDate(cpm.finishDate).toUpperCase() : '—'}</div>
        <div class="kpi-label">PROJECTED COMPLETION</div>
        <div class="kpi-note">${cpm?.available ? `CPM ${esc(cpm.revision)}` : 'No active CPM'}</div>
      </div>
    </div>

    <div class="slabel">REMAINING WORK BY DIVISION</div>
    <table class="ft">
      <thead>
        <tr>
          <th class="gold" style="text-align:left">DIV</th>
          <th class="dim" style="text-align:right">REVISED</th>
          <th class="dim" style="text-align:right">EXECUTED</th>
          <th class="gold" style="text-align:right">REMAINING</th>
          <th class="dim" style="text-align:right">% EXECUTED</th>
        </tr>
      </thead>
      <tbody>
        ${divisions.map(d => {
          const p = d.revised > 0 ? (d.executed / d.revised) * 100 : 0;
          return `<tr>
            <td style="font-weight:700">${esc(d.code)}</td>
            <td class="r">${fmt$(d.revised)}</td>
            <td class="r dim">${fmt$(d.executed)}</td>
            <td class="r" style="color:#C9A96E">${fmt$(d.remaining)}</td>
            <td class="r dim">${fmtPct(p)}</td>
          </tr>`;
        }).join('')}
        <tr class="total">
          <td>TOTAL</td>
          <td class="r">${fmt$(totals.revised)}</td>
          <td class="r">${fmt$(totals.executed)}</td>
          <td class="r" style="color:#C9A96E">${fmt$(totals.remaining)}</td>
          <td class="r">${fmtPct(pctExecuted)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="ftr">
    <div>${esc(brand.nameUpper)}${brand.addressFull ? ` | ${esc(brand.addressFull)}` : ''}</div>
    <div>Page 1 of 2</div>
    <div>CONFIDENTIAL</div>
  </div>
</div>

<!-- ════════════════ PAGE 2 ════════════════ -->
<div class="page">
  <div class="p2-hdr">
    <div class="p2-hdr-text">PROJECTED CASH FLOW | ${esc(project.projectName.toUpperCase())} | GENERATED ${todayShort.toUpperCase()}</div>
  </div>
  <div class="gold-line"></div>

  <div class="p2-body">
    <div class="slabel">MONTHLY PROJECTED OWNER DRAWS</div>
    <table class="ft">
      <thead>
        <tr>
          <th class="gold" style="text-align:left">MONTH</th>
          <th class="gold" style="text-align:right">PROJECTED DRAW</th>
          <th class="dim" style="text-align:right">CUMULATIVE PROJECTED</th>
          <th class="dim" style="text-align:right">% OF REMAINING</th>
          <th class="dim" style="text-align:right">REMAINING AFTER MONTH</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const pctOfRem = totals.remaining > 0 ? (r.cum / totals.remaining) * 100 : 0;
          const left = Math.max(0, totals.remaining - r.cum);
          return `<tr>
            <td style="font-weight:600">${esc(r.label)}</td>
            <td class="r" style="color:#C9A96E">${fmt$(r.amount)}</td>
            <td class="r">${fmt$(r.cum)}</td>
            <td class="r dim">${fmtPct(Math.min(100, pctOfRem))}</td>
            <td class="r ${left <= 1 ? 'dim' : ''}">${fmt$(left)}</td>
          </tr>`;
        }).join('')}
        <tr class="total">
          <td>TOTAL PROJECTED</td>
          <td class="r" style="color:#C9A96E">${fmt$(rows.reduce((s, r) => s + r.amount, 0))}</td>
          <td class="r">${fmt$(rows.length > 0 ? rows[rows.length - 1].cum : 0)}</td>
          <td class="r"></td>
          <td class="r">${fmt$(Math.max(0, leftAtEnd))}</td>
        </tr>
      </tbody>
    </table>

    <div class="note-box">
      <div class="note-text">
        ${noteLines.map(n => `<div>• ${esc(n)}</div>`).join('')}
        <div>• Generated by ${esc(brand.name)} on ${todayStr}. Figures are projections for planning purposes and do not constitute a payment application.</div>
      </div>
    </div>
  </div>

  <div class="ftr">
    <div>${esc(brand.nameUpper)} | Prepared by ${esc(brand.name)} | ${todayShort}</div>
    <div>Page 2 of 2</div>
    <div>CONFIDENTIAL</div>
  </div>
</div>

</body></html>`;

    const pdfBytes = await htmlToPdf(htmlContent, {
      width: '11in',
      height: '8.5in',
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Projected_CashFlow_${project.projectNumber}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Projected cashflow PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
