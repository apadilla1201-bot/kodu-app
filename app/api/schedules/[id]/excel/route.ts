export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

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
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * 86400000); }
function diffDays(a: Date, b: Date) { return (b.getTime() - a.getTime()) / 86400000; }
function getMonday(d: Date) {
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  dt.setHours(0, 0, 0, 0);
  return dt;
}

interface Activity {
  activityId: string; activityName: string; activityType: string;
  originalDuration: number; remainingDuration: number; percentComplete: number;
  startDate: Date | null; finishDate: Date | null;
  status: string; isCritical: boolean; isMilestone: boolean;
  notes: string | null; sortOrder: number;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Auth' }, { status: 401 });
    const companyId = (session?.user as any)?.companyId ?? '';

    let filterType = 'all';
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;
    try {
      const body = await request.json();
      filterType = body.filter || 'all';
      if (body.dateFrom) dateFrom = new Date(body.dateFrom);
      if (body.dateTo) dateTo = new Date(body.dateTo);
    } catch {}

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

    const acts = schedule.activities as unknown as Activity[];

    // Build group-children map for filtering
    const groupChildren = new Map<number, number[]>();
    let currentGroup = -1;
    acts.forEach((a, i) => {
      if (a.activityType.startsWith('group_')) { currentGroup = i; groupChildren.set(i, []); }
      else if (currentGroup >= 0) groupChildren.get(currentGroup)?.push(i);
    });

    // Filter by status/critical
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

    // Filter by date range
    if (dateFrom || dateTo) {
      const dfTime = dateFrom ? dateFrom.getTime() : -Infinity;
      const dtTime = dateTo ? dateTo.getTime() : Infinity;
      const childInRange = new Set<number>();
      filtered.forEach((a, i) => {
        if (!a.activityType.startsWith('group_') && a.startDate) {
          const s = new Date(a.startDate).getTime();
          const e = new Date(a.finishDate || a.startDate).getTime();
          if (s <= dtTime && e >= dfTime) childInRange.add(i);
        }
      });
      const fgc = new Map<number, number[]>();
      let cg2 = -1;
      filtered.forEach((a, i) => {
        if (a.activityType.startsWith('group_')) { cg2 = i; fgc.set(i, []); }
        else if (cg2 >= 0) fgc.get(cg2)?.push(i);
      });
      filtered = filtered.filter((a, i) => {
        if (a.activityType.startsWith('group_')) {
          const children = fgc.get(i) || [];
          return children.some(ci => childInRange.has(ci));
        }
        return childInRange.has(i);
      });
    }

    // Timeline computation
    const tasks = acts.filter(a => a.startDate && ['task', 'milestone'].includes(a.activityType));
    const starts = tasks.map(a => new Date(a.startDate!).getTime());
    const ends = tasks.map(a => new Date(a.finishDate || a.startDate!).getTime());
    const rangeMinDate = dateFrom || new Date(Math.min(...starts));
    const rangeMaxDate = dateTo || new Date(Math.max(...ends));
    const ganttStart = addDays(getMonday(rangeMinDate), -7);
    const ganttEnd = getMonday(addDays(rangeMaxDate, 14));

    const weeks: Date[] = [];
    let d = new Date(ganttStart);
    while (d <= ganttEnd) { weeks.push(new Date(d)); d = addDays(d, 7); }

    const totalDays = diffDays(ganttStart, ganttEnd);
    const dd = new Date(schedule.dataDate);

    // ── Build Excel ──────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('CPM Schedule', { views: [{ state: 'frozen', xSplit: 8, ySplit: 3 }] });

    // Fixed columns
    const fixedCols: Partial<ExcelJS.Column>[] = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Activity Name', key: 'name', width: 42 },
      { header: 'Orig Dur', key: 'origDur', width: 7 },
      { header: 'Rem Dur', key: 'remDur', width: 7 },
      { header: '% Comp', key: 'pctComp', width: 7 },
      { header: 'Start', key: 'start', width: 10 },
      { header: 'Finish', key: 'finish', width: 10 },
      { header: 'Status', key: 'status', width: 9 },
    ];
    // Week columns
    const weekCols = weeks.map((w, i) => ({
      header: fmtShort(w), key: `w${i}`, width: 3.5,
    }));
    ws.columns = [...fixedCols, ...weekCols];

    // ── Row 1: Title row ──
    const projName = schedule.project.projectName || '';
    const projNum = schedule.project.projectNumber || '';
    const title = `${projName} (${projNum}) | CPM — ${schedule.revision} | Data Date: ${fmtDate(schedule.dataDate)}`;
    ws.mergeCells(1, 1, 1, 8 + weeks.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1B33' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(1).height = 22;

    // ── Row 2: Month headers ──
    let colIdx = 9; // 1-based, after 8 fixed cols
    const monthMap: { label: string; startCol: number; endCol: number }[] = [];
    let lastKey = '';
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      const mos = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const key = `${w.getFullYear()}-${w.getMonth()}`;
      if (key === lastKey) {
        monthMap[monthMap.length - 1].endCol = colIdx + i;
      } else {
        monthMap.push({ label: `${mos[w.getMonth()]} ${w.getFullYear()}`, startCol: colIdx + i, endCol: colIdx + i });
        lastKey = key;
      }
    }
    // Fixed header cells for row 2
    const hdrFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    const hdrFont: Partial<ExcelJS.Font> = { bold: true, size: 8 };
    const hdrBorder: Partial<ExcelJS.Borders> = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
    const hdrAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
    const fixedHeaders = ['ID', 'Activity Name', 'Orig Dur', 'Rem Dur', '% Comp', 'Start', 'Finish', 'Status'];
    for (let c = 1; c <= 8; c++) {
      const cell = ws.getCell(2, c);
      cell.value = fixedHeaders[c - 1];
      cell.font = hdrFont; cell.fill = hdrFill; cell.border = hdrBorder; cell.alignment = hdrAlign;
    }
    // Month headers merged cells
    const monthFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF404040' } };
    const monthFont: Partial<ExcelJS.Font> = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
    for (const m of monthMap) {
      if (m.startCol !== m.endCol) ws.mergeCells(2, m.startCol, 2, m.endCol);
      const cell = ws.getCell(2, m.startCol);
      cell.value = m.label;
      cell.font = monthFont; cell.fill = monthFill; cell.alignment = hdrAlign;
    }
    ws.getRow(2).height = 16;

    // ── Row 3: Week headers ──
    for (let c = 1; c <= 8; c++) {
      const cell = ws.getCell(3, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
    }
    for (let i = 0; i < weeks.length; i++) {
      const isDD = Math.abs(diffDays(weeks[i], dd)) < 4;
      const cell = ws.getCell(3, 9 + i);
      cell.value = fmtShort(weeks[i]);
      cell.font = { size: 7, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isDD ? 'FFB8973A' : 'FF595959' } };
      cell.alignment = hdrAlign;
    }
    ws.getRow(3).height = 13;

    // ── Data rows ──
    const getRowFill = (a: Activity, idx: number): ExcelJS.Fill => {
      if (a.activityType === 'group_main') return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1B33' } };
      if (a.activityType === 'group_sub') return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF6E3' } };
      if (a.activityType === 'group_warn') return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC55A11' } };
      if (a.activityType === 'group_crit') return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };
      if (a.status === 'done') return { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF0F7E6' : 'FFE8F1DC' } };
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF7F7F5' } };
    };

    const getRowFont = (a: Activity): Partial<ExcelJS.Font> => {
      const isGroup = a.activityType.startsWith('group_');
      const isLight = ['group_main', 'group_warn', 'group_crit'].includes(a.activityType);
      return {
        bold: isGroup || a.isCritical,
        size: isGroup ? 8 : 8,
        color: { argb: isLight ? 'FFFFFFFF' : 'FF333333' },
      };
    };

    const stLabel = (st: string): string => {
      if (st === 'done') return 'Done';
      if (st === 'ip') return 'In Prog';
      return 'Pend';
    };
    const stColor = (st: string): string => {
      if (st === 'done') return 'FF2E5E0E';
      if (st === 'ip') return 'FF0C447C';
      return 'FF888888';
    };

    // Gantt bar color helpers
    const barArgb = (a: Activity): string => {
      if (a.status === 'done') return 'FF4472C4';
      if (a.isCritical) return 'FFFF0000';
      return 'FFC9A96E';
    };
    const progressArgb = 'FF4472C4';
    const milestoneArgb = (a: Activity) => a.isCritical ? 'FFFF0000' : 'FF4472C4';

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };

    filtered.forEach((a, idx) => {
      const rowNum = idx + 4; // rows 1-3 are headers
      const isGroup = a.activityType.startsWith('group_');
      const rowFill = getRowFill(a, idx);
      const rowFont = getRowFont(a);
      const row = ws.getRow(rowNum);
      row.height = 14;

      // Fixed data cells
      const vals = [
        isGroup ? '' : a.activityId,
        a.activityName,
        isGroup ? '' : a.originalDuration,
        isGroup ? '' : a.remainingDuration,
        isGroup ? '' : a.percentComplete / 100,
        isGroup ? '' : (a.startDate ? new Date(a.startDate) : ''),
        isGroup ? '' : (a.finishDate ? new Date(a.finishDate) : ''),
        isGroup ? '' : stLabel(a.status),
      ];

      for (let c = 1; c <= 8; c++) {
        const cell = ws.getCell(rowNum, c);
        cell.value = vals[c - 1] as any;
        cell.fill = rowFill;
        cell.border = thinBorder;
        cell.alignment = c === 2 ? { vertical: 'middle', wrapText: false } : { horizontal: 'center', vertical: 'middle' };
        if (c === 5 && !isGroup) {
          cell.numFmt = '0%';
          cell.font = rowFont;
        } else if ((c === 6 || c === 7) && !isGroup) {
          cell.numFmt = 'M/D';
          cell.font = { ...rowFont, size: 7 };
        } else if (c === 8 && !isGroup) {
          cell.font = { ...rowFont, bold: a.status === 'done' || a.status === 'ip', color: { argb: stColor(a.status) } };
        } else {
          cell.font = c === 1 ? { ...rowFont, color: { argb: ['group_main','group_warn','group_crit'].includes(a.activityType) ? 'FFFFFFFF' : 'FF1F4E79' } } : rowFont;
        }
      }

      // Gantt columns — fill cells that overlap the activity's date range
      if (!isGroup && a.startDate) {
        const actStart = new Date(a.startDate);
        const actEnd = a.finishDate ? new Date(a.finishDate) : actStart;
        const isMilestone = a.isMilestone || a.originalDuration === 0;

        for (let i = 0; i < weeks.length; i++) {
          const weekStart = weeks[i];
          const weekEnd = addDays(weekStart, 7);
          const cell = ws.getCell(rowNum, 9 + i);
          cell.border = { right: { style: 'hair', color: { argb: 'FFE0E0E0' } } };

          // Check if data date falls in this week
          const isDataDateWeek = dd >= weekStart && dd < weekEnd;

          if (isMilestone) {
            // Milestone: fill the week it falls in
            if (actStart >= weekStart && actStart < weekEnd) {
              cell.value = '◆';
              cell.font = { size: 9, color: { argb: milestoneArgb(a) } };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (isDataDateWeek) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
            }
          } else {
            // Regular bar: fill weeks that overlap activity range
            const overlapStart = Math.max(actStart.getTime(), weekStart.getTime());
            const overlapEnd = Math.min(actEnd.getTime(), weekEnd.getTime());
            if (overlapEnd > overlapStart) {
              // This week overlaps with the activity
              // Calculate progress split
              const actDuration = Math.max(1, diffDays(actStart, actEnd));
              const progressEnd = addDays(actStart, actDuration * (a.percentComplete / 100));

              if (a.status === 'done' || a.percentComplete >= 100) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: progressArgb } };
              } else if (a.percentComplete > 0 && progressEnd.getTime() > weekStart.getTime()) {
                // Check if this week is fully in progress part, partially, or fully remaining
                if (progressEnd.getTime() >= weekEnd.getTime()) {
                  // Fully in done portion
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: progressArgb } };
                } else if (progressEnd.getTime() > weekStart.getTime()) {
                  // Mixed — show progress color (dominant visual)
                  cell.fill = { type: 'pattern', pattern: 'lightUp', fgColor: { argb: progressArgb }, bgColor: { argb: barArgb(a).replace('FF', '') } };
                } else {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: barArgb(a) } };
                }
              } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: barArgb(a) } };
              }
            } else if (isDataDateWeek) {
              // Subtle highlight for data date week
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
            }
          }
        }
      } else if (isGroup) {
        // Group rows: extend the group color across all week columns
        for (let i = 0; i < weeks.length; i++) {
          ws.getCell(rowNum, 9 + i).fill = rowFill;
        }
      }
    });

    // ── Legend row ──
    const legendRow = filtered.length + 5;
    ws.getCell(legendRow, 1).value = 'Legend:';
    ws.getCell(legendRow, 1).font = { bold: true, size: 8 };
    const legends = [
      { label: 'Done / Progress', argb: 'FF4472C4' },
      { label: 'Remaining', argb: 'FFC9A96E' },
      { label: 'Critical', argb: 'FFFF0000' },
    ];
    for (let i = 0; i < legends.length; i++) {
      const c = 2 + i * 2;
      const swatch = ws.getCell(legendRow, c);
      swatch.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: legends[i].argb } };
      swatch.border = thinBorder;
      ws.getCell(legendRow, c + 1).value = legends[i].label;
      ws.getCell(legendRow, c + 1).font = { size: 7 };
    }

    // ── Footer ──
    const ftrRow = legendRow + 1;
    ws.getCell(ftrRow, 1).value = `© Kodu GC · Confidential — THE PROJECT DELIVERY GROUP, LLC`;
    ws.getCell(ftrRow, 1).font = { italic: true, size: 7, color: { argb: 'FF888888' } };

    // Generate buffer
    const buf = await wb.xlsx.writeBuffer();
    const fileName = `CPM_${schedule.project.projectNumber || ''}_${schedule.revision}.xlsx`;

    return new NextResponse(buf as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error('Excel export error:', err);
    return NextResponse.json({ error: 'Failed to export Excel' }, { status: 500 });
  }
}
