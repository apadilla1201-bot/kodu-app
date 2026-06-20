export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/* ── Formatters ────────────────────────────────────────── */
const fmtK = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};
const fmtBig = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 100_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};
const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtDate = (d: string | Date | null) => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')) : d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtDateShort = (d: string | Date | null) => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')) : d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(mo) - 1]} '${y.slice(2)}`;
};

/* ── Data helpers ────────────────────────────────────── */
interface MonthBucket { key: string; start: Date; end: Date; }

function generateMonthBuckets(from: Date, to: Date, extra = 2): MonthBucket[] {
  const months: MonthBucket[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const endTarget = new Date(to); endTarget.setMonth(endTarget.getMonth() + extra);
  while (cur <= endTarget) {
    months.push({ key: cur.toISOString().slice(0, 7), start: new Date(cur), end: new Date(cur.getFullYear(), cur.getMonth() + 1, 0) });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function distributeToMonths(acts: any[], months: MonthBucket[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of acts) {
    if (!a.startDate || !a.finishDate || !a.costLoaded) continue;
    const s = a.startDate.getTime(), f = a.finishDate.getTime();
    const dur = Math.max(f - s, 86400000);
    const daily = a.costLoaded / (dur / 86400000);
    for (const m of months) {
      const ms = Math.max(m.start.getTime(), s), me = Math.min(m.end.getTime(), f);
      if (ms > me) continue;
      map.set(m.key, (map.get(m.key) || 0) + daily * ((me - ms) / 86400000));
    }
  }
  return map;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id ?? '';

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        schedules: {
          include: { activities: { where: { isLookAhead: false }, orderBy: { sortOrder: 'asc' } } },
          orderBy: { createdAt: 'asc' },
        },
        payApplications: {
          include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { applicationNumber: 'asc' },
        },
        changeOrders: { where: { status: 'Approved' } },
      },
    });

    if (!project || project.userId !== userId)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const payApps = project.payApplications;
    if (payApps.length === 0)
      return NextResponse.json({ error: 'No Pay Applications found' }, { status: 400 });

    /* ── Data computation ─────────────────────────────── */
    const allSchedules = project.schedules;
    const originalSchedule = allSchedules[0] || null;
    const activeSchedule = allSchedules.find(s => s.status === 'Active') || originalSchedule;
    const hasModifiedCPM = activeSchedule && originalSchedule && activeSchedule.id !== originalSchedule.id;

    const firstPADate = payApps[0].periodFrom;
    const lastDates: Date[] = payApps.map(pa => pa.periodTo);
    if (activeSchedule) activeSchedule.activities.forEach(a => { if (a.finishDate) lastDates.push(a.finishDate); });
    if (originalSchedule && hasModifiedCPM) originalSchedule.activities.forEach(a => { if (a.finishDate) lastDates.push(a.finishDate); });
    const maxDate = new Date(Math.max(...lastDates.map(d => d.getTime())));
    const months = generateMonthBuckets(firstPADate, maxDate, 2);

    // Out-of-pocket
    const oopMonthly = new Map<string, number>();
    const paDetails: { paNum: number; period: string; gross: number; ret: number; net: number }[] = [];
    for (const pa of payApps) {
      const mk = pa.periodTo.toISOString().slice(0, 7);
      const items = pa.lineItems.filter(li => !li.isSection);
      const gross = items.reduce((s, li) => s + (li.thisCompleted || 0), 0);
      const retRate = pa.retainagePercent || 0.10;
      const ret = gross * retRate;
      const net = gross - ret;
      oopMonthly.set(mk, (oopMonthly.get(mk) || 0) + net);
      paDetails.push({ paNum: pa.applicationNumber, period: fmtDate(pa.periodTo), gross: Math.round(gross), ret: Math.round(ret), net: Math.round(net) });
    }

    // Projections
    const origTasks = originalSchedule
      ? originalSchedule.activities.filter(a => (a.activityType === 'task' || a.activityType === 'milestone') && a.costLoaded > 0)
      : [];
    const origProj = distributeToMonths(origTasks, months);
    let currProj: Map<string, number> | null = null;
    if (hasModifiedCPM && activeSchedule) {
      const at = activeSchedule.activities.filter(a => (a.activityType === 'task' || a.activityType === 'milestone') && a.costLoaded > 0);
      currProj = distributeToMonths(at, months);
    }

    // Build series
    let cumOOP = 0, cumOrig = 0, cumCurr = 0;
    const series = months.map(m => {
      const oop = oopMonthly.get(m.key) || 0;
      const orig = origProj.get(m.key) || 0;
      const curr = currProj?.get(m.key) ?? null;
      cumOOP += oop; cumOrig += orig; if (curr !== null) cumCurr += curr;
      return { month: m.key, oop: Math.round(oop), cumOOP: Math.round(cumOOP), orig: Math.round(orig), cumOrig: Math.round(cumOrig), curr: curr !== null ? Math.round(curr) : null, cumCurr: curr !== null ? Math.round(cumCurr) : null };
    });

    // KPIs
    const totalOOP = Array.from(oopMonthly.values()).reduce((s, v) => s + v, 0);
    const totalBudget = origTasks.reduce((s, a) => s + (a.costLoaded || 0), 0);
    const totalApprovedCOs = project.changeOrders.reduce((s, co) => s + co.totalAmount, 0);
    const coCount = project.changeOrders.length;
    const contractAmount = project.contractAmount || 0;
    const adjustedContract = contractAmount + totalApprovedCOs;
    const retRate = payApps[payApps.length - 1]?.retainagePercent || 0.10;
    const grossBilled = payApps.reduce((sum, pa) => sum + pa.lineItems.filter(li => !li.isSection).reduce((s, li) => s + (li.thisCompleted || 0), 0), 0);
    const retainageHeld = grossBilled * retRate;
    const remainingBudget = totalBudget - totalOOP;
    const pctDisbursed = totalBudget > 0 ? (totalOOP / totalBudget) * 100 : 0;
    const pctBilledOfContract = adjustedContract > 0 ? (grossBilled / adjustedContract) * 100 : 0;
    const origFinish = originalSchedule ? originalSchedule.activities.filter(a => a.finishDate).reduce((mx, a) => (a.finishDate! > mx ? a.finishDate! : mx), new Date(0)) : null;
    const currentFinish = activeSchedule && hasModifiedCPM ? activeSchedule.activities.filter(a => a.finishDate).reduce((mx, a) => (a.finishDate! > mx ? a.finishDate! : mx), new Date(0)) : null;
    const completionDate = currentFinish || origFinish;
    const dataDate = activeSchedule?.dataDate || new Date();
    const totalActivities = activeSchedule?.activities.length || 0;
    const completedActivities = activeSchedule?.activities.filter(a => a.percentComplete >= 100).length || 0;
    const pctActivitiesComplete = totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;
    const burnRate = payApps.length > 0 ? totalOOP / payApps.length : 0;
    const monthsRemaining = burnRate > 0 ? remainingBudget / burnRate : 0;
    const costPerfRatio = totalBudget > 0 ? (totalOOP / (series.find(s => s.cumOOP === Math.round(totalOOP))?.cumOrig || totalBudget)).toFixed(3) : '—';

    // Variance
    const lastMonthWithOOP = series.filter(s => s.oop > 0).slice(-1)[0];
    const varianceAtLastOOP = lastMonthWithOOP ? lastMonthWithOOP.cumOOP - lastMonthWithOOP.cumOrig : 0;
    const variancePct = lastMonthWithOOP && lastMonthWithOOP.cumOrig > 0 ? (varianceAtLastOOP / lastMonthWithOOP.cumOrig) * 100 : 0;

    const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const dataDateStr = dataDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    const dataDateShort = dataDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Determine analyst headline for page 2
    const bigLineItems = payApps.flatMap(pa => pa.lineItems.filter(li => !li.isSection && (li.thisCompleted || 0) > 50000)).sort((a, b) => (b.thisCompleted || 0) - (a.thisCompleted || 0));
    const topItem = bigLineItems[0];
    const headlineDriver = topItem ? topItem.description?.slice(0, 60) || 'Major Line Items' : 'Disbursements';
    const topItemVal = topItem ? fmtBig(topItem.thisCompleted || 0) : '';

    /* ── SVG: Monthly Disbursement Bar Chart ─────────── */
    const activeMonths = series.filter(s => s.orig > 0 || s.oop > 0);
    const chartW = 460, chartH = 200, cPadL = 40, cPadR = 10, cPadT = 20, cPadB = 30;
    const cPlotW = chartW - cPadL - cPadR, cPlotH = chartH - cPadT - cPadB;
    const maxBar = Math.max(...activeMonths.map(s => Math.max(s.oop, s.orig)), 1);
    // Round max to nice number
    const niceMax = (() => {
      const mag = Math.pow(10, Math.floor(Math.log10(maxBar)));
      return Math.ceil(maxBar / mag) * mag;
    })();
    const barGroupW = activeMonths.length > 0 ? cPlotW / activeMonths.length : cPlotW;
    const bw = Math.min(barGroupW * 0.35, 30);
    const barGap = 3;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => ({ val: niceMax * p, y: cPadT + cPlotH - (p * cPlotH) }));
    const bToY = (v: number) => cPadT + cPlotH - (v / niceMax) * cPlotH;

    const svgBarChart = `<svg xmlns="https://i.ytimg.com/vi/Wk8pIxcidv8/maxresdefault.jpg" width="${chartW}" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" style="font-family:Inter,sans-serif">
      <!-- Grid lines -->
      ${yTicks.map(t => `<line x1="${cPadL}" y1="${t.y.toFixed(1)}" x2="${chartW - cPadR}" y2="${t.y.toFixed(1)}" stroke="#e0ddd8" stroke-width="0.5"/>`).join('')}
      ${yTicks.map(t => `<text x="${cPadL - 4}" y="${(t.y + 3).toFixed(1)}" text-anchor="end" fill="#999" font-size="8" font-weight="500">${Math.round(t.val / 1000)}</text>`).join('')}
      <!-- Legend -->
      <rect x="${chartW - 150}" y="2" width="10" height="10" fill="#C9A96E" opacity="0.35" rx="1"/>
      <text x="${chartW - 136}" y="10" fill="#888" font-size="7.5">CPM Projected ($K)</text>
      <rect x="${chartW - 70}" y="2" width="10" height="10" fill="#0F1B33" rx="1"/>
      <text x="${chartW - 56}" y="10" fill="#888" font-size="7.5">Actual OOP ($K)</text>
      <!-- Bars -->
      ${activeMonths.map((s, i) => {
        const cx = cPadL + i * barGroupW + barGroupW / 2;
        const origH = (s.orig / niceMax) * cPlotH;
        const oopH = (s.oop / niceMax) * cPlotH;
        const baseY = cPadT + cPlotH;
        return [
          `<rect x="${(cx - bw - barGap / 2).toFixed(1)}" y="${(baseY - origH).toFixed(1)}" width="${bw.toFixed(1)}" height="${origH.toFixed(1)}" fill="#C9A96E" opacity="0.35" rx="2"/>`,
          s.oop > 0 ? `<rect x="${(cx + barGap / 2).toFixed(1)}" y="${(baseY - oopH).toFixed(1)}" width="${bw.toFixed(1)}" height="${oopH.toFixed(1)}" fill="#0F1B33" rx="2"/>` : '',
          `<text x="${cx.toFixed(1)}" y="${(chartH - 8).toFixed(1)}" text-anchor="middle" fill="#999" font-size="8">${fmtMonth(s.month)}</text>`,
        ].join('');
      }).join('')}
      <!-- Axes -->
      <line x1="${cPadL}" y1="${cPadT + cPlotH}" x2="${chartW - cPadR}" y2="${cPadT + cPlotH}" stroke="#ccc" stroke-width="0.5"/>
    </svg>`;

    /* ── Build HTML ─── Exact PPTX replica, landscape ── */
    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #F5F3EF; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .serif { font-family: 'Playfair Display', Georgia, serif; }

  .page { width: 11in; height: 8.5in; position: relative; overflow: hidden; page-break-after: always; background: #F5F3EF; }
  .page:last-child { page-break-after: auto; }

  /* ── HEADER BAR ── */
  .hdr { background: #0F1B33; padding: 14px 50px 12px; display: flex; justify-content: space-between; align-items: flex-start; }
  .hdr-left { }
  .hdr-eyebrow { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #C9A96E; font-weight: 600; }
  .hdr-eyebrow span { color: rgba(255,255,255,0.4); }
  .hdr-project { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 800; color: #C9A96E; margin-top: 2px; letter-spacing: -0.3px; }
  .hdr-right { text-align: right; color: rgba(255,255,255,0.5); font-size: 8.5px; line-height: 1.5; }
  .gold-line { height: 3px; background: linear-gradient(90deg, #C9A96E 0%, #B8975D 60%, rgba(201,169,110,0.15) 100%); }

  /* ── BODY ── */
  .body { padding: 20px 50px 0; }

  /* ── SECTION TITLE (serif) ── */
  .sec-title { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 800; color: #0F1B33; line-height: 1.15; letter-spacing: -0.5px; margin-bottom: 3px; }
  .sec-title-bar { width: 4px; background: #C9A96E; border-radius: 2px; margin-right: 16px; align-self: stretch; }
  .sec-title-wrap { display: flex; align-items: stretch; margin-bottom: 6px; }
  .sec-subtitle { font-size: 10px; text-transform: uppercase; letter-spacing: 2.5px; color: #999; font-weight: 600; margin-bottom: 2px; }
  .sec-desc { font-size: 10.5px; color: #666; line-height: 1.55; max-width: 620px; margin-bottom: 16px; }

  /* ── KPI CARDS ── */
  .kpi-row { display: flex; gap: 14px; margin-bottom: 14px; }
  .kpi-card { flex: 1; background: #fff; border: 1px solid #e8e5e0; border-radius: 8px; padding: 14px 16px; position: relative; }
  .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 8px 8px 0 0; }
  .kpi-card.gold::before { background: #C9A96E; } .kpi-card.blue::before { background: #3B82F6; } .kpi-card.amber::before { background: #D97706; } .kpi-card.green::before { background: #10B981; }
  .kpi-val { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 800; color: #0F1B33; line-height: 1.1; }
  .kpi-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1.8px; color: #999; font-weight: 700; margin-top: 6px; }
  .kpi-note { font-size: 9px; color: #888; margin-top: 6px; }
  .kpi-note strong { color: #C9A96E; font-weight: 700; }

  /* ── KEY DRIVER BOX ── */
  .driver-box { background: #fff; border: 1px solid #e8e5e0; border-radius: 8px; padding: 14px 18px 14px 18px; display: flex; gap: 12px; align-items: flex-start; margin-bottom: 14px; position: relative; overflow: hidden; }
  .driver-box::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #C9A96E; }
  .driver-icon { width: 28px; height: 28px; border-radius: 50%; background: #EBE6DC; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 6px; }
  .driver-icon svg { width: 14px; height: 14px; }
  .driver-text { font-size: 10px; line-height: 1.6; color: #333; }
  .driver-text strong { color: #0F1B33; font-weight: 700; }
  .driver-text .gold { color: #C9A96E; font-weight: 700; }
  .driver-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0F1B33; margin-bottom: 3px; }

  /* ── WATERFALL ── */
  .wf-section { margin-bottom: 8px; }
  .wf-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 2px; color: #999; font-weight: 700; margin-bottom: 6px; }
  .wf-bars { display: flex; align-items: center; gap: 0; }
  .wf-bar { height: 30px; border-radius: 4px; display: flex; align-items: center; padding: 0 14px; font-size: 10px; font-weight: 600; color: #fff; white-space: nowrap; }
  .wf-bar.navy { background: #0F1B33; }
  .wf-bar.gold { background: #C9A96E; }
  .wf-bar.green { background: #6B8F71; }
  .wf-arrow { width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-left: 10px solid #C9A96E; margin: 0 2px; flex-shrink: 0; }

  /* ── FOOTER ── */
  .ftr { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 50px; font-size: 7.5px; color: #aaa; letter-spacing: 0.5px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; }

  /* ═══ PAGE 2 ═══ */
  .p2-hdr { background: #0F1B33; padding: 8px 50px; }
  .p2-hdr-text { font-family: 'Playfair Display', serif; font-size: 11px; color: rgba(255,255,255,0.65); letter-spacing: 0.3px; }
  .p2-headline { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 800; color: #0F1B33; letter-spacing: -0.3px; line-height: 1.2; margin-bottom: 12px; }
  .p2-body { padding: 14px 50px 0; }
  .p2-grid { display: flex; gap: 30px; }
  .p2-left { flex: 1; }
  .p2-right { flex: 1; }

  /* Section labels */
  .slabel { font-size: 8px; text-transform: uppercase; letter-spacing: 2.2px; color: #999; font-weight: 700; margin-bottom: 8px; }

  /* Tables */
  .ft { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .ft thead th { font-size: 8px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #0F1B33; }
  .ft thead th.gold { color: #C9A96E; } .ft thead th.dim { color: #888; }
  .ft tbody td { padding: 6px 10px; font-size: 10px; border-bottom: 1px solid #e8e5e0; }
  .ft td.r { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .ft td.dim { color: #888; }
  .ft td.warn { color: #D97706; }
  .ft td.blue { color: #3B82F6; }
  .ft td.pos { color: #10B981; }
  .ft td.neg { color: #EF4444; }
  .ft tr:last-child td { border-bottom: none; }

  /* Metric cards row */
  .metric-row { display: flex; gap: 10px; margin-bottom: 12px; }
  .metric-card { flex: 1; background: #fff; border: 1px solid #e8e5e0; border-radius: 6px; padding: 10px 12px; }
  .metric-val { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 800; color: #0F1B33; }
  .metric-val.gold { color: #C9A96E; }
  .metric-val.red { color: #EF4444; }
  .metric-label { font-size: 7.5px; color: #888; margin-top: 2px; }
  .metric-label .tag { font-weight: 700; }
  .metric-label .red { color: #EF4444; }
  .metric-label .green { color: #10B981; }

  /* Variance strip */
  .var-strip { background: #fff; border: 1px solid #e8e5e0; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; position: relative; overflow: hidden; }
  .var-strip::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #C9A96E; }
  .var-text { font-size: 10px; color: #333; line-height: 1.55; padding-left: 8px; }
  .var-text strong { font-weight: 700; color: #0F1B33; }
  .var-text .red { color: #EF4444; font-weight: 700; }
  .var-text .green { color: #10B981; font-weight: 700; }
  .var-text .gold { color: #C9A96E; font-weight: 700; }

  /* Root cause box */
  .rc-box { background: #fff; border: 1px solid #e8e5e0; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; position: relative; overflow: hidden; }
  .rc-box::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #0F1B33; }
  .rc-title { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #EF4444; margin-bottom: 3px; padding-left: 8px; }
  .rc-text { font-size: 9.5px; color: #333; line-height: 1.55; padding-left: 8px; }
  .rc-text strong { font-weight: 700; color: #0F1B33; }
  .rc-text .gold { color: #C9A96E; font-weight: 700; }

  /* Analyst box */
  .analyst-box { background: #fff; border: 1px solid #e8e5e0; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; }
  .analyst-title { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; color: #999; font-weight: 700; margin-bottom: 5px; }
  .analyst-text { font-size: 9.5px; color: #333; line-height: 1.6; }
  .analyst-text strong { font-weight: 700; color: #0F1B33; }
  .analyst-text .red { color: #EF4444; font-weight: 700; }
  .analyst-text .gold { color: #C9A96E; font-weight: 700; }

  /* Schedule milestones strip */
  .ms-strip { background: #fff; border: 1px solid #e8e5e0; border-radius: 6px; padding: 10px 16px; display: flex; gap: 6px; align-items: center; font-size: 10px; color: #333; flex-wrap: wrap; }
  .ms-strip .sep { color: #ddd; margin: 0 4px; }
  .ms-strip strong { font-weight: 700; color: #0F1B33; }

  .divider { height: 1px; background: #ddd; margin: 10px 0; }
</style>
</head>
<body>

<!-- ════════════════ PAGE 1 ════════════════ -->
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <div class="hdr-eyebrow">OWNER EQUITY POSITION REPORT <span>|</span> ${dataDateStr} <span>|</span> CONFIDENTIAL</div>
      <div class="hdr-project">${project.projectName.toUpperCase()}</div>
    </div>
    <div class="hdr-right">
      ${project.client} | Project #${project.projectNumber}${project.location ? ` | ${project.location}` : ''}
    </div>
  </div>
  <div class="gold-line"></div>

  <div class="body">
    <!-- Section Title -->
    <div class="sec-title-wrap">
      <div class="sec-title-bar"></div>
      <div>
        <div class="sec-title">CASH FLOW EXECUTIVE REPORT</div>
        <div class="sec-subtitle">CUMULATIVE CASH FLOW — ACTUAL VS. CPM BASELINE | DATA DATE: ${dataDateStr}</div>
      </div>
    </div>
    <div class="sec-desc">
      Comprehensive owner equity and disbursement analysis for ${project.projectName} — tracking actual vs. projected capital deployment and supplier advance obligations.
    </div>

    <!-- KPI Cards -->
    <div class="kpi-row">
      <div class="kpi-card gold">
        <div class="kpi-val">${fmtBig(totalOOP)}</div>
        <div class="kpi-label">NET OOP DISBURSED</div>
        <div class="kpi-note"><strong>${fmtPct(pctDisbursed)}</strong> of CPM budget deployed</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-val">${fmtBig(remainingBudget)}</div>
        <div class="kpi-label">REMAINING EXPOSURE</div>
        <div class="kpi-note"><strong>~${monthsRemaining.toFixed(1)} months</strong> runway at burn</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-val">${fmtBig(retainageHeld)}</div>
        <div class="kpi-label">RETAINAGE HELD</div>
        <div class="kpi-note">${(retRate * 100).toFixed(0)}% release at substantial completion</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-val">${fmtBig(adjustedContract)}</div>
        <div class="kpi-label">ADJUSTED CONTRACT VALUE</div>
        <div class="kpi-note"><strong>${fmtPct(pctBilledOfContract)}</strong> utilized to date</div>
      </div>
    </div>

    <!-- Key Driver Box -->
    <div class="driver-box">
      <div class="driver-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#C9A96E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </div>
      <div>
        <div class="driver-title">KEY DRIVER — ${payApps.length === 1 ? fmtMonth(payApps[0].periodTo.toISOString().slice(0, 7)).toUpperCase() : 'LATEST'} PAY APPLICATION:</div>
        <div class="driver-text">
          The <strong>${fmtBig(totalOOP)}</strong> ${payApps.length === 1 ? 'first-month' : 'cumulative'} disbursement is driven by ${topItem ? `<strong>supplier material advances</strong>, including a <span class="gold">${fmtBig(topItem.thisCompleted || 0)} advance to ${topItem.description?.slice(0, 40) || 'supplier'}</span>` : '<strong>scheduled contract billings</strong>'}${bigLineItems.length > 1 ? `, plus ${bigLineItems.length - 1} additional items totaling <strong>${fmtBig(bigLineItems.slice(1).reduce((s, li) => s + (li.thisCompleted || 0), 0))}</strong>` : ''}. These are <strong>planned front-loaded obligations</strong>, not cost overruns.
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider"></div>

    <!-- Contract Waterfall -->
    <div class="wf-section">
      <div class="wf-label">CONTRACT WATERFALL</div>
      <div class="wf-bars">
        <div class="wf-bar navy" style="flex: ${contractAmount};">Contract ${fmtBig(adjustedContract)}</div>
        <div class="wf-arrow"></div>
        <div class="wf-bar gold" style="flex: ${grossBilled};">Gross Billed ${fmtBig(grossBilled)}</div>
        <div class="wf-arrow"></div>
        <div class="wf-bar green" style="flex: ${totalOOP};">Net OOP ${fmtBig(totalOOP)}</div>
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div style="position:absolute;bottom:28px;left:50px;right:50px;height:1px;background:#ddd"></div>

  <div class="ftr">
    <div>THE PROJECT DELIVERY GROUP, LLC | 7255 NE 4th Ave., Miami, FL 33138</div>
    <div>Page 1 of 2</div>
    <div>CONFIDENTIAL</div>
  </div>
</div>

<!-- ════════════════ PAGE 2 ════════════════ -->
<div class="page">
  <div class="p2-hdr">
    <div class="p2-hdr-text">CASH FLOW ANALYSIS | ${project.projectName.toUpperCase()} | DATA DATE: ${dataDateStr}</div>
  </div>
  <div class="gold-line"></div>

  <div class="p2-body">
    <div class="p2-headline">ACCELERATED BURN RATE DRIVEN BY ${bigLineItems.length > 0 ? headlineDriver.toUpperCase() + (topItemVal ? ` — ${topItemVal.toUpperCase()} DEPOSIT` : '') : 'SCHEDULED DISBURSEMENTS'}</div>

    <div class="p2-grid">

      <!-- LEFT COLUMN -->
      <div class="p2-left">
        <div style="width:36px;height:3px;background:#C9A96E;border-radius:2px;margin-bottom:10px"></div>
        <div class="slabel">SOURCES & USES OF FUNDS</div>
        <table class="ft">
          <thead><tr><th class="gold" style="text-align:left">DESCRIPTION</th><th class="gold" style="text-align:right">AMOUNT</th></tr></thead>
          <tbody>
            <tr><td>Original Contract Sum</td><td class="r">${fmt$(contractAmount)}</td></tr>
            ${totalApprovedCOs > 0 ? `<tr><td>Approved Change Orders (${coCount})</td><td class="r" style="color:#C9A96E">+${fmt$(totalApprovedCOs)}</td></tr>` : ''}
            <tr><td>Gross Amount Billed (${payApps.length} PA${payApps.length !== 1 ? 's' : ''})</td><td class="r">${fmt$(grossBilled)}</td></tr>
            <tr><td>Less: Retainage Withheld (${(retRate * 100).toFixed(0)}%)</td><td class="r warn">(${fmt$(retainageHeld)})</td></tr>
            <tr><td style="font-weight:700">Net Owner Disbursements (OOP)</td><td class="r" style="font-weight:800">${fmt$(totalOOP)}</td></tr>
            <tr><td>Remaining CPM Budget (Unfunded)</td><td class="r blue">${fmt$(remainingBudget)}</td></tr>
          </tbody>
        </table>

        <div class="slabel">PERFORMANCE METRICS</div>
        <div class="metric-row">
          <div class="metric-card">
            <div class="metric-val">${costPerfRatio}x</div>
            <div class="metric-label">Cost Perf. (OOP/CPM)<br/><span class="tag ${Number(costPerfRatio) > 1.1 ? 'red' : 'green'}">${Number(costPerfRatio) > 1.1 ? 'Caution' : 'Healthy'}</span></div>
          </div>
          <div class="metric-card">
            <div class="metric-val gold">${fmtBig(burnRate)}</div>
            <div class="metric-label">Billing Velocity<br/>avg. over ${payApps.length} period${payApps.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="metric-card">
            <div class="metric-val gold">${fmtPct(pctBilledOfContract)}</div>
            <div class="metric-label">Contract Utilization<br/>gross billed / contract</div>
          </div>
        </div>

        <!-- Variance Strip -->
        <div class="var-strip">
          <div class="var-text">
            <strong>Variance:</strong> <span class="${varianceAtLastOOP > 0 ? 'red' : 'green'}">${varianceAtLastOOP > 0 ? '+' : ''}${fmtBig(Math.abs(varianceAtLastOOP))} (${variancePct > 0 ? '+' : ''}${fmtPct(variancePct)})</span> over CPM baseline | 
            <strong>Schedule:</strong> ${completedActivities}/${totalActivities} complete (<span class="gold">${fmtPct(pctActivitiesComplete)}</span>) | 
            <strong>Completion:</strong> ${completionDate ? fmtDateShort(completionDate) : '—'}
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="p2-right">
        <div class="slabel">MONTHLY DISBURSEMENT COMPARISON</div>
        ${svgBarChart}

        <!-- Root Cause Box -->
        <div class="rc-box">
          <div class="rc-title">ROOT CAUSE — ${payApps.length === 1 ? fmtMonth(payApps[0].periodTo.toISOString().slice(0, 7)).toUpperCase() : 'LATEST'} PAY APPLICATION:</div>
          <div class="rc-text">
            The <strong>${fmtBig(totalOOP)}</strong> out-of-pocket is driven by ${topItem ? `<strong>supplier material advances</strong>, chiefly a <span class="gold">${fmtBig(topItem.thisCompleted || 0)} advance to ${topItem.description?.slice(0, 40) || 'supplier'}</span>` : '<strong>scheduled billings</strong>'}${bigLineItems.length > 1 ? `, plus equipment and material prepayments` : ''}. These are <strong>planned front-loaded obligations</strong>, not cost overruns.
          </div>
        </div>

        <!-- Analyst Commentary -->
        <div class="analyst-box">
          <div class="analyst-title">ANALYST COMMENTARY</div>
          <div class="analyst-text">
            As of <strong>${dataDateShort}</strong>, owner disbursed <strong>${fmtBig(totalOOP)}</strong> net OOP (<strong>${fmtPct(pctDisbursed)}</strong> of CPM budget). ${Math.abs(varianceAtLastOOP) > 1000 ? `Variance <span class="red">${varianceAtLastOOP > 0 ? '+' : ''}${fmtBig(Math.abs(varianceAtLastOOP))} (${variancePct > 0 ? '+' : ''}${fmtPct(variancePct)})</span> vs. baseline is explained by ${variancePct > 50 ? 'supplier deposit requirements' : 'scheduling differences'}.` : 'Actual disbursements are tracking close to the CPM baseline projection.'}
            <br/>Remaining budget: <strong>~${monthsRemaining.toFixed(1)} months</strong> runway. ${coCount > 0 ? `${coCount} change order${coCount !== 1 ? 's' : ''} approved totaling <strong>${fmtBig(totalApprovedCOs)}</strong>.` : 'No change orders approved.'}
          </div>
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="divider"></div>

    <!-- Schedule Milestones -->
    <div class="slabel">SCHEDULE MILESTONES</div>
    <div class="ms-strip">
      First Disbursement <strong>${fmtDate(firstPADate)}</strong>
      <span class="sep">|</span>
      Completion <strong>${completionDate ? fmtDate(completionDate) : '—'}</strong>
      <span class="sep">|</span>
      Activities <strong>${completedActivities} / ${totalActivities}</strong> (${fmtPct(pctActivitiesComplete)})
      <span class="sep">|</span>
      Retainage <strong>At Substantial Completion</strong>
    </div>
  </div>

  <!-- Divider -->
  <div style="position:absolute;bottom:28px;left:50px;right:50px;height:1px;background:#ddd"></div>

  <div class="ftr">
    <div>THE PROJECT DELIVERY GROUP, LLC | Prepared by PDG Construction Management | Data Date: ${dataDateShort}</div>
    <div>Page 2 of 2</div>
    <div>CONFIDENTIAL</div>
  </div>
</div>

</body></html>`;

    /* ── Generate PDF ──────────────────────────────────── */
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        html_content: htmlContent,
        pdf_options: {
          width: '11in',
          height: '8.5in',
          margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
          print_background: true,
          landscape: false,
        },
        base_url: baseUrl,
      }),
    });

    if (!createResponse.ok) {
      console.error('PDF create error:', await createResponse.text());
      return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
    }

    const { request_id } = await createResponse.json();
    if (!request_id) return NextResponse.json({ error: 'No request ID' }, { status: 500 });

    let attempts = 0;
    while (attempts < 60) {
      await new Promise(r => setTimeout(r, 1500));
      const statusRes = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      });
      const statusResult = await statusRes.json();
      if (statusResult?.status === 'SUCCESS' && statusResult?.result?.result) {
        const pdfBytes = Buffer.from(statusResult.result.result, 'base64');
        return new NextResponse(pdfBytes, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Owner_Equity_Report_${project.projectNumber}.pdf"`,
          },
        });
      }
      if (statusResult?.status === 'FAILED') break;
      attempts++;
    }

    return NextResponse.json({ error: 'PDF generation timed out' }, { status: 500 });
  } catch (error: any) {
    console.error('Owner executive PDF error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
