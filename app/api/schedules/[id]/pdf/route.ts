export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import { createTranslator } from '@/lib/i18n';
import { getSessionLocale } from '@/lib/i18n/server';

/* ── Helpers ──────────────────────────────────────────────── */
function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtShort(d: Date | string | null) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function fmtDate(d: Date | string | null) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dt.getDate()}-${months[dt.getMonth()]}-${dt.getFullYear().toString().slice(-2)}`;
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}
function diffDays(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 86400000;
}
function getMonday(d: Date) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

interface Activity {
  activityId: string;
  activityName: string;
  activityType: string;
  originalDuration: number;
  remainingDuration: number;
  percentComplete: number;
  startDate: Date | null;
  finishDate: Date | null;
  status: string;
  isCritical: boolean;
  isMilestone: boolean;
  notes: string | null;
  sortOrder: number;
}

/* ── POST handler ─────────────────────────────────────────── */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Auth' }, { status: 401 });
    const companyId = (session?.user as any)?.companyId ?? '';

    // Accept optional filter from body
    let filterType = 'all';
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;
    try {
      const body = await request.json();
      filterType = body.filter || 'all';
      if (body.dateFrom) dateFrom = new Date(body.dateFrom);
      if (body.dateTo) dateTo = new Date(body.dateTo);
    } catch { /* no body is fine */ }

    const locale = await getSessionLocale();
    const t = createTranslator(locale);
    const S = (key: string) => t(`schedules.${key}`);

    const schedule = await prisma.schedule.findFirst({
      where: { id: params.id, project: { companyId } },
      include: {
        activities: { orderBy: { sortOrder: 'asc' } },
        project: { select: { projectName: true, projectNumber: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const acts = schedule.activities as Activity[];

    // Build group-children map for filtering
    const groupChildren = new Map<number, number[]>();
    let currentGroup = -1;
    acts.forEach((a, i) => {
      if (a.activityType.startsWith('group_')) {
        currentGroup = i;
        groupChildren.set(i, []);
      } else if (currentGroup >= 0) {
        groupChildren.get(currentGroup)?.push(i);
      }
    });

    // Filter activities by status/critical
    let filtered = acts.filter((a, i) => {
      if (filterType === 'all') return true;
      if (a.activityType.startsWith('group_')) {
        const children = groupChildren.get(i) || [];
        return children.some(ci => {
          const c = acts[ci];
          if (filterType === 'crit') return c.isCritical;
          return c.status === filterType;
        });
      }
      if (filterType === 'crit') return a.isCritical;
      return a.status === filterType;
    });

    // Filter by date range if provided
    if (dateFrom || dateTo) {
      const dfTime = dateFrom ? dateFrom.getTime() : -Infinity;
      const dtTime = dateTo ? dateTo.getTime() : Infinity;
      // Keep groups that have at least one child in range, and tasks that overlap the range
      const childInRange = new Set<number>();
      filtered.forEach((a, i) => {
        if (!a.activityType.startsWith('group_') && a.startDate) {
          const s = new Date(a.startDate).getTime();
          const e = new Date(a.finishDate || a.startDate).getTime();
          // Activity overlaps range if it starts before range end AND finishes after range start
          if (s <= dtTime && e >= dfTime) childInRange.add(i);
        }
      });
      // Rebuild group membership for filtered list
      const filteredGroupChildren2 = new Map<number, number[]>();
      let cg2 = -1;
      filtered.forEach((a, i) => {
        if (a.activityType.startsWith('group_')) { cg2 = i; filteredGroupChildren2.set(i, []); }
        else if (cg2 >= 0) filteredGroupChildren2.get(cg2)?.push(i);
      });
      filtered = filtered.filter((a, i) => {
        if (a.activityType.startsWith('group_')) {
          const children = filteredGroupChildren2.get(i) || [];
          return children.some(ci => childInRange.has(ci));
        }
        return childInRange.has(i);
      });
    }

    // Timeline computation
    const WW = 22;
    const ROW_H = 15;
    const tasks = acts.filter(a => a.startDate && ['task', 'milestone'].includes(a.activityType));
    const starts = tasks.map(a => new Date(a.startDate!).getTime());
    const ends = tasks.map(a => new Date(a.finishDate || a.startDate!).getTime());
    // Use date range bounds if provided, otherwise full schedule range
    const rangeMinDate = dateFrom ? dateFrom : new Date(Math.min(...starts));
    const rangeMaxDate = dateTo ? dateTo : new Date(Math.max(...ends));
    const ganttStart = addDays(getMonday(rangeMinDate), -7);
    const ganttEnd = getMonday(addDays(rangeMaxDate, 14));

    const weeks: Date[] = [];
    let d = new Date(ganttStart);
    while (d <= ganttEnd) { weeks.push(new Date(d)); d = addDays(d, 7); }

    const monthMap: { label: string; span: number }[] = [];
    let lastKey = '';
    for (const w of weeks) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const key = `${w.getFullYear()}-${w.getMonth()}`;
      if (key === lastKey) { monthMap[monthMap.length - 1].span++; }
      else { monthMap.push({ label: `${months[w.getMonth()]} ${w.getFullYear()}`, span: 1 }); lastKey = key; }
    }

    const totalWidth = weeks.length * WW;
    const totalDays = diffDays(ganttStart, ganttEnd);
    const dd = new Date(schedule.dataDate);
    const dataDateX = totalDays > 0 ? (diffDays(ganttStart, dd) / totalDays) * totalWidth : 0;

    // Stats
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(a => a.status === 'done').length;
    const critTasks = tasks.filter(a => a.isCritical).length;
    const avgPct = totalTasks > 0 ? Math.round(tasks.reduce((s, a) => s + a.percentComplete, 0) / totalTasks) : 0;
    const tcoDate = schedule.tcoDate ? new Date(schedule.tcoDate) : null;
    const daysToTCO = tcoDate ? Math.max(0, Math.round(diffDays(dd, tcoDate))) : null;

    // Row class
    const rowClass = (a: Activity, idx: number) => {
      if (a.activityType === 'group_main') return 'background:#0F1B33;color:#fff;font-weight:700;font-size:9px';
      if (a.activityType === 'group_sub') return 'background:#C9A96E20;font-weight:700;font-size:8px';
      if (a.activityType === 'group_warn') return 'background:#C55A11;color:#fff;font-weight:700;font-size:8px';
      if (a.activityType === 'group_crit') return 'background:#C00000;color:#fff;font-weight:700;font-size:8px';
      if (a.status === 'done') return idx % 2 === 0 ? 'background:#f0f7e6' : 'background:#e8f1dc';
      return idx % 2 === 0 ? 'background:#fff' : 'background:#F7F7F5';
    };

    // SVG bar for each task
    const barSvg = (a: Activity) => {
      if (a.activityType.startsWith('group_')) return '';
      if (!a.startDate) return `<svg width="${totalWidth}" height="${ROW_H}" style="display:block;min-width:${totalWidth}px"><line x1="${dataDateX}" y1="0" x2="${dataDateX}" y2="${ROW_H}" stroke="#B8973A" stroke-width="1.5" stroke-dasharray="3,2"/></svg>`;

      const start = new Date(a.startDate);
      const end = new Date(a.finishDate || a.startDate);
      const x = (diffDays(ganttStart, start) / totalDays) * totalWidth;
      const w = Math.max(3, (diffDays(ganttStart, end) / totalDays) * totalWidth - x);

      if (a.isMilestone || a.originalDuration === 0) {
        const cx = x + w / 2;
        const color = a.isCritical ? '#FF0000' : '#4472C4';
        return `<svg width="${totalWidth}" height="${ROW_H}" style="display:block;min-width:${totalWidth}px">
          <polygon points="${cx},2 ${cx+5},${ROW_H/2} ${cx},${ROW_H-2} ${cx-5},${ROW_H/2}" fill="${color}" />
          <line x1="${dataDateX}" y1="0" x2="${dataDateX}" y2="${ROW_H}" stroke="#B8973A" stroke-width="1.5" stroke-dasharray="3,2"/>
        </svg>`;
      }

      // Bar colors
      let barColor = '#C9A96E';
      if (a.status === 'done') barColor = '#4472C4';
      else if (a.isCritical) barColor = '#FF0000';

      const pctW = w * (a.percentComplete / 100);
      let bars = '';
      if (a.status === 'done') {
        bars = `<rect x="${x}" y="3" width="${w}" height="${ROW_H-6}" fill="${barColor}" rx="1"/>`;
      } else if (a.percentComplete > 0) {
        bars = `<rect x="${x}" y="3" width="${pctW}" height="${ROW_H-6}" fill="#4472C4" rx="1"/>`
             + `<rect x="${x + pctW}" y="3" width="${w - pctW}" height="${ROW_H-6}" fill="${barColor}" rx="1"/>`;
      } else {
        bars = `<rect x="${x}" y="3" width="${w}" height="${ROW_H-6}" fill="${barColor}" rx="1"/>`;
      }
      bars += `<rect x="${x}" y="3" width="${w}" height="${ROW_H-6}" fill="none" stroke="rgba(0,0,0,.15)" stroke-width=".5" rx="1"/>`;
      bars += `<line x1="${dataDateX}" y1="0" x2="${dataDateX}" y2="${ROW_H}" stroke="#B8973A" stroke-width="1.5" stroke-dasharray="3,2"/>`;

      return `<svg width="${totalWidth}" height="${ROW_H}" style="display:block;min-width:${totalWidth}px">${bars}</svg>`;
    };

    // Status label
    const stLabel = (st: string) => {
      if (st === 'done') return '<span style="color:#2E5E0E;font-weight:700">Done</span>';
      if (st === 'ip') return '<span style="color:#0C447C;font-weight:700">In Prog</span>';
      return '<span style="color:#888">Pend</span>';
    };

    // Build rows
    let rowsHtml = '';
    filtered.forEach((a, idx) => {
      const isGroup = a.activityType.startsWith('group_');
      const style = rowClass(a, idx);
      rowsHtml += `<tr style="${style};height:${ROW_H}px">`;
      // ID
      rowsHtml += `<td style="border:1px solid #ccc;text-align:center;font-size:7px;color:#1F4E79;padding:0 2px;width:38px;min-width:38px">${isGroup ? '' : esc(a.activityId)}</td>`;
      // Name
      const nameStyle = (isGroup || a.isCritical) ? 'font-weight:700' : '';
      rowsHtml += `<td style="border:1px solid #ccc;padding:0 3px;font-size:7.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;min-width:240px;${nameStyle}">${esc(a.activityName)}</td>`;
      // Orig Dur
      rowsHtml += `<td style="border:1px solid #ccc;text-align:center;font-size:7px;width:28px">${isGroup ? '' : a.originalDuration}</td>`;
      // Rem Dur
      rowsHtml += `<td style="border:1px solid #ccc;text-align:center;font-size:7px;width:28px">${isGroup ? '' : a.remainingDuration}</td>`;
      // % Complete
      rowsHtml += `<td style="border:1px solid #ccc;text-align:center;font-size:7px;width:34px">${isGroup ? '' : a.percentComplete + '%'}</td>`;
      // Start
      rowsHtml += `<td style="border:1px solid #ccc;text-align:center;font-size:6.5px;width:54px">${isGroup ? '' : fmtShort(a.startDate)}</td>`;
      // Finish
      rowsHtml += `<td style="border:1px solid #ccc;text-align:center;font-size:6.5px;width:54px">${isGroup ? '' : fmtShort(a.finishDate)}</td>`;
      // Status
      rowsHtml += `<td style="border:1px solid #ccc;text-align:center;font-size:7px;width:52px">${isGroup ? '' : stLabel(a.status)}</td>`;
      // Gantt bar
      if (isGroup) {
        rowsHtml += `<td colspan="${weeks.length}" style="border:0;padding:0;${style}"></td>`;
      } else {
        rowsHtml += `<td colspan="${weeks.length}" style="border:0;padding:0;overflow:hidden">${barSvg(a)}</td>`;
      }
      rowsHtml += '</tr>';
    });

    // Month headers
    let monthsHtml = '';
    monthMap.forEach(m => {
      monthsHtml += `<th colspan="${m.span}" style="background:#404040;color:#fff;font-weight:700;text-align:center;font-size:7px;border-right:1px solid rgba(255,255,255,0.15);min-width:${m.span * WW}px">${m.label}</th>`;
    });

    // Week headers
    let weeksHtml = '';
    weeks.forEach(w => {
      const isDD = Math.abs(diffDays(w, dd)) < 4;
      const bg = isDD ? 'background:rgba(184,151,58,.35)' : 'background:#595959';
      weeksHtml += `<th style="${bg};color:#fff;text-align:center;font-size:6.5px;border-right:1px solid rgba(255,255,255,0.1);min-width:${WW}px">${fmtShort(w)}</th>`;
    });

    const projectName = schedule.project.projectName || '';
    const filterLabel = filterType === 'all' ? S('filterAll') : filterType === 'crit' ? S('filterCritical') : filterType === 'ip' ? S('filterInProgress') : filterType === 'done' ? S('filterCompleted') : S('filterPending');
    const dateRangeLabel = (dateFrom || dateTo) ? `Date Range: ${dateFrom ? fmtDate(dateFrom) : 'Start'} — ${dateTo ? fmtDate(dateTo) : 'End'}` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; }
  table { border-collapse:collapse; }
  th, td { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  .hdr { background:#0F1B33; color:#fff; padding:6px 12px; display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #C9A96E; }
  .hdr h1 { font-size:11px; font-weight:700; }
  .hdr .info { font-size:8px; display:flex; gap:12px; align-items:center; }
  .hdr .info b { color:#C9A96E; }
  .ftr { display:flex; align-items:center; justify-content:space-between; padding:4px 10px; border-top:2px solid #595959; font-size:7px; }
  .ftr .leg { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .ftr .sq { display:inline-block; width:12px; height:7px; border:1px solid #999; }
  .ftr .dd-line { display:inline-block; width:14px; border-top:1.5px dashed #B8973A; vertical-align:middle; }
</style></head><body>

<div class="hdr">
  <h1>${esc(projectName)} | Interactive CPM — ${esc(schedule.revision)}</h1>
  <div class="info">
    <span>Filter: <b>${filterLabel}</b></span>
    ${dateRangeLabel ? `<span><b>${dateRangeLabel}</b></span>` : ''}
    <span>Data Date: <b>${fmtDate(schedule.dataDate)}</b></span>
    ${tcoDate ? `<span>TCO: <b>${fmtDate(tcoDate)}</b></span>` : ''}
    <span>Progress: <b>${avgPct}%</b></span>
    <span>${esc(S('critical'))}: <b>${critTasks}</b></span>
    ${daysToTCO !== null ? `<span>Days to TCO: <b>${daysToTCO}</b></span>` : ''}
  </div>
</div>

<table style="width:100%">
  <thead>
    <tr>
      <th style="background:#D9D9D9;font-weight:700;text-align:center;font-size:7px;width:38px;min-width:38px">ID</th>
      <th style="background:#D9D9D9;font-weight:700;text-align:center;font-size:7px;width:240px;min-width:240px">${esc(S('activityName'))}</th>
      <th style="background:#D9D9D9;font-weight:700;text-align:center;font-size:6.5px;width:28px;line-height:1.1">Orig<br>Dur</th>
      <th style="background:#D9D9D9;font-weight:700;text-align:center;font-size:6.5px;width:28px;line-height:1.1">Rem<br>Dur</th>
      <th style="background:#D9D9D9;font-weight:700;text-align:center;font-size:6.5px;width:34px;line-height:1.1">Dur%<br>Comp</th>
      <th style="background:#D9D9D9;font-weight:700;text-align:center;font-size:6.5px;width:54px">Start</th>
      <th style="background:#D9D9D9;font-weight:700;text-align:center;font-size:6.5px;width:54px">Finish</th>
      <th style="background:#D9D9D9;font-weight:700;text-align:center;font-size:6.5px;width:52px">Status</th>
      ${monthsHtml}
    </tr>
    <tr>
      <th style="background:#595959;height:10px"></th>
      <th style="background:#595959;height:10px"></th>
      <th style="background:#595959;height:10px"></th>
      <th style="background:#595959;height:10px"></th>
      <th style="background:#595959;height:10px"></th>
      <th style="background:#595959;height:10px"></th>
      <th style="background:#595959;height:10px"></th>
      <th style="background:#595959;height:10px"></th>
      ${weeksHtml}
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>

<div class="ftr">
  <div class="leg">
    <div><span class="sq" style="background:#4472C4"></span> Actual (Done/Billed)</div>
    <div><span class="sq" style="background:#C9A96E"></span> Remaining Work</div>
    <div><span class="sq" style="background:#FF0000"></span> ${esc(S('criticalRemaining'))}</div>
    <div>◆ Milestone</div>
    <div><span class="dd-line"></span> Data Date</div>
  </div>
  <div style="text-align:center;flex:1">
    <div style="font-size:10px;font-weight:700">${esc(projectName)} | Interactive CPM</div>
    <div style="font-size:8px;font-weight:700">${esc(schedule.revision)} | ${esc(schedule.notes || '')}</div>
  </div>
  <div style="text-align:right;min-width:100px;line-height:1.6">
    ${schedule.projectFinish ? `<div>${esc(S('projectFinish'))}: ${fmtDate(schedule.projectFinish)}</div>` : ''}
    <div>Data Date: ${fmtDate(schedule.dataDate)}</div>
    ${tcoDate ? `<div>TCO: ${fmtDate(tcoDate)}</div>` : ''}
    <div>Prepared: A. Padilla — PDG</div>
  </div>
</div>

</body></html>`;

    // ── Generate PDF locally ─────────────────────────
    const pdfBuf = await htmlToPdf(html, {
      format: 'Tabloid',
      landscape: true,
      margin: { top: '4mm', right: '3mm', bottom: '4mm', left: '3mm' },
      scale: 0.85,
    });
    const projNum = schedule.project.projectNumber || 'CPM';
    const rev = schedule.revision || '';
    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CPM_${projNum}_${rev}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Schedule PDF error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
