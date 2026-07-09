/**
 * Ritz-style 2-Week Look-Ahead annex PDFs — Executive + Technical.
 */
import { GC_NAME_UPPER } from '@/lib/gc-branding';

export type LookAheadActivity = {
  id: string;
  activityId: string;
  activityName: string;
  originalDuration: number;
  remainingDuration: number;
  percentComplete: number;
  startDate: Date | null;
  finishDate: Date | null;
  status: string;
  floatDays: number;
  notes: string | null;
  resourceName: string | null;
  isLookAhead: boolean;
};

export type ExecutiveSectionItem = {
  title: string;
  description: string;
};

export type ExecutiveContent = {
  status: 'ON TRACK' | 'AT RISK' | 'DELAYED';
  statusNarrative: string;
  siteOperations: ExecutiveSectionItem[];
  offSiteProduction: ExecutiveSectionItem[];
  ownerAction: {
    title: string;
    deadline: string;
    status: string;
    description: string;
  } | null;
  executiveBrief: string;
};

export type LookAheadPdfInput = {
  projectName: string;
  projectNumber: string;
  client: string | null;
  location: string | null;
  revision: string;
  dataDate: Date;
  tcoDate: Date | null;
  windowStart: Date;
  windowEnd: Date;
  preparedBy: string;
  activities: LookAheadActivity[];
  executive: ExecutiveContent;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtShort(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtMonthDay(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtMonthDayShort(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtWindowRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${s} – ${e}`;
}

function fmtWindowRangeUpper(start: Date, end: Date): string {
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const sM = months[start.getMonth()];
  const eM = months[end.getMonth()];
  if (sM === eM) return `${sM} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  return `${sM.substring(0, 3)} ${start.getDate()} – ${eM.substring(0, 3)} ${end.getDate()}, ${start.getFullYear()}`;
}

export function extractAction(name: string): { cleanName: string; action: string } {
  const m = name.match(/\[([^\]]+)\]\s*$/);
  if (m) {
    return {
      cleanName: name.replace(/\s*\[[^\]]+\]\s*$/, '').replace(/^LA-/, ''),
      action: m[1].toUpperCase(),
    };
  }
  return { cleanName: name.replace(/^LA-/, ''), action: '' };
}

function statusLabel(s: string): string {
  if (s === 'done') return 'Done';
  if (s === 'ip') return 'In Prog';
  return 'Pending';
}

function statusCode(s: string): string {
  if (s === 'done') return 'DONE';
  if (s === 'ip') return 'IP';
  return 'PEND';
}

function projectDisplayTitle(name: string, number: string): string {
  const upper = (name || 'PROJECT').toUpperCase();
  if (upper.includes('RITZ') && number) return `RITZ CARLTON ${number.toUpperCase()}`;
  if (number) return `${upper} · ${number.toUpperCase()}`;
  return upper;
}

function residenceLine(client: string | null, projectName: string): string {
  if (client) return client;
  const m = projectName.match(/(.+?)\s*(?:residence|penthouse|suite)/i);
  return m ? m[1].trim() : projectName;
}

function inferSection(act: LookAheadActivity): string {
  const id = (act.activityId || '').toUpperCase();
  const name = act.activityName.toUpperCase();
  if (id.startsWith('M-') || name.includes('OWNER') || name.includes('DECISION')) return 'Owner Decisions';
  if (id.startsWith('S-') || name.includes('SUBMITTAL') || name.includes('PROCUREMENT') || name.includes('SHOP DRAW')) {
    return 'Procurement & Submittals';
  }
  if (
    id.startsWith('B-') ||
    name.includes('FABRICAT') ||
    name.includes('BUYOUT') ||
    name.includes('OFF-SITE') ||
    name.includes('OFFSITE')
  ) {
    return 'Off-Site Production';
  }
  if (name.includes('WELLNESS') || name.includes('SPA') || name.includes('SAUNA')) return 'Wellness & Specialty';
  if (name.includes('HARDWOOD') || name.includes('FLOOR') || name.includes('WOOD FLOOR')) return 'Hardwood & Flooring';
  if (name.includes('MARBLE') || name.includes('STONE') || name.includes('COUNTERTOP')) return 'Stone & Countertops';
  if (name.includes('KITCHEN') || name.includes('MILLWORK') || name.includes('CABINET')) return 'Interior & Millwork';
  if (name.includes('HVAC') || name.includes('ELECTR') || name.includes('PLUMB') || name.includes('MEP') || name.includes('SPRINKLER')) {
    return 'Building Systems';
  }
  if (name.includes('FRAME') || name.includes('DRYWALL') || name.includes('PAINT') || name.includes('TILE')) {
    return 'Interior Build-Out';
  }
  return 'Field Operations';
}

function classifyActivities(activities: LookAheadActivity[], windowStart: Date, windowEnd: Date) {
  const starts: LookAheadActivity[] = [];
  const finishes: LookAheadActivity[] = [];
  const continues: LookAheadActivity[] = [];
  const critical: LookAheadActivity[] = [];

  for (const act of activities) {
    const { action } = extractAction(act.activityName);
    const isCritical = act.floatDays === 0 && act.status !== 'done';
    if (isCritical) critical.push(act);

    if (action.includes('START') && action.includes('FINISH')) continues.push(act);
    else if (action.includes('FINISH')) finishes.push(act);
    else if (action.includes('START')) starts.push(act);
    else if (action.includes('CONTINU')) continues.push(act);
    else {
      const s = act.startDate;
      const f = act.finishDate;
      if (s && s >= windowStart && s <= windowEnd) starts.push(act);
      else if (f && f >= windowStart && f <= windowEnd) finishes.push(act);
      else continues.push(act);
    }
  }

  return { starts, finishes, continues, critical };
}

function activityBarType(act: LookAheadActivity): 'critical' | 'ip' | 'pend' | 'owner' | 'done' {
  const name = act.activityName.toUpperCase();
  if (act.status === 'done') return 'done';
  if (name.includes('OWNER') || (act.activityId || '').toUpperCase().startsWith('M-')) return 'owner';
  if (act.floatDays === 0) return 'critical';
  if (act.status === 'ip') return 'ip';
  return 'pend';
}

function barColor(type: ReturnType<typeof activityBarType>): string {
  if (type === 'critical') return '#8B0000';
  if (type === 'ip') return '#1F4E79';
  if (type === 'owner') return '#C9A96E';
  if (type === 'done') return '#6b7280';
  return '#9ca3af';
}

function dayInRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start) return false;
  const e = end || start;
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const sT = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const eT = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
  return d >= sT && d <= eT;
}

function buildDayColumns(windowStart: Date): Date[] {
  return Array.from({ length: 14 }, (_, i) => new Date(windowStart.getTime() + i * 86400000));
}

function groupBySection(activities: LookAheadActivity[]): { section: string; items: LookAheadActivity[] }[] {
  const map = new Map<string, LookAheadActivity[]>();
  const order = [
    'Owner Decisions',
    'Procurement & Submittals',
    'Off-Site Production',
    'Stone & Countertops',
    'Hardwood & Flooring',
    'Interior & Millwork',
    'Wellness & Specialty',
    'Interior Build-Out',
    'Building Systems',
    'Field Operations',
  ];

  for (const act of activities) {
    const section = inferSection(act);
    if (!map.has(section)) map.set(section, []);
    map.get(section)!.push(act);
  }

  const result: { section: string; items: LookAheadActivity[] }[] = [];
  for (const section of order) {
    const items = map.get(section);
    if (items?.length) result.push({ section, items });
  }
  for (const [section, items] of map) {
    if (!order.includes(section)) result.push({ section, items });
  }
  return result;
}

function itemFromActivity(act: LookAheadActivity): ExecutiveSectionItem {
  const { cleanName } = extractAction(act.activityName);
  const parts = cleanName.split('—').map((p) => p.trim());
  const title = parts[0] || cleanName;
  const descParts: string[] = [];
  if (parts[1]) descParts.push(parts[1]);
  if (act.notes) descParts.push(act.notes);
  const datePart = act.startDate && act.finishDate
    ? `${fmtMonthDayShort(act.startDate)} – ${fmtMonthDayShort(act.finishDate)}`
    : '';
  if (datePart) descParts.push(datePart);
  if (act.floatDays === 0 && act.status !== 'done') descParts.push('Critical path — zero float.');
  return {
    title,
    description: descParts.join(' · ') || `Scheduled ${fmtShort(act.startDate)} – ${fmtShort(act.finishDate)}`,
  };
}

export function buildFallbackExecutiveContent(
  input: Pick<LookAheadPdfInput, 'activities' | 'windowStart' | 'windowEnd' | 'tcoDate'>
): ExecutiveContent {
  const { starts, finishes, continues, critical } = classifyActivities(
    input.activities,
    input.windowStart,
    input.windowEnd
  );

  const siteActs = input.activities.filter((a) => {
    const s = inferSection(a);
    return !['Owner Decisions', 'Procurement & Submittals', 'Off-Site Production'].includes(s);
  });
  const offSiteActs = input.activities.filter((a) =>
    ['Procurement & Submittals', 'Off-Site Production'].includes(inferSection(a))
  );
  const ownerActs = input.activities.filter(
    (a) =>
      inferSection(a) === 'Owner Decisions' ||
      a.activityName.toUpperCase().includes('OWNER')
  );

  const status: ExecutiveContent['status'] =
    critical.length >= 3 ? 'AT RISK' : critical.length > 0 ? 'AT RISK' : 'ON TRACK';

  const tco = input.tcoDate ? fmtMonthDay(input.tcoDate) : 'TBD';
  const statusNarrative =
    status === 'ON TRACK'
      ? `The project remains on track for the reporting window. ${starts.length} activities start, ${finishes.length} complete, and ${continues.length} continue in parallel. TCO target holds at ${tco}.`
      : `${critical.length} critical-path activit${critical.length === 1 ? 'y requires' : 'ies require'} close coordination this window. TCO target remains ${tco} with active recovery measures in place.`;

  const ownerAct = ownerActs[0];
  const ownerAction = ownerAct
    ? {
        title: extractAction(ownerAct.activityName).cleanName.split('—')[0].trim(),
        deadline: ownerAct.finishDate ? fmtMonthDay(ownerAct.finishDate) : 'This window',
        status: ownerAct.status === 'ip' ? 'IN REVIEW' : 'AWAITING FINAL LOCK',
        description:
          ownerAct.notes ||
          `Owner decision required to release downstream work. Float: ${ownerAct.floatDays}d.`,
      }
    : critical[0]
      ? {
          title: extractAction(critical[0].activityName).cleanName.split('—')[0].trim(),
          deadline: critical[0].finishDate ? fmtMonthDay(critical[0].finishDate) : 'Immediate',
          status: 'CRITICAL PATH',
          description: 'Zero-float activity — schedule sensitivity requires prompt action.',
        }
      : null;

  return {
    status,
    statusNarrative,
    siteOperations: siteActs.slice(0, 6).map(itemFromActivity),
    offSiteProduction: offSiteActs.slice(0, 5).map(itemFromActivity),
    ownerAction,
    executiveBrief: `${input.activities.length} coordinated activities span the next two weeks. Field and off-site production remain synchronized to the CPM baseline. ${critical.length ? `Priority focus: ${critical.slice(0, 2).map((a) => extractAction(a.activityName).cleanName.split('—')[0].trim()).join('; ')}.` : 'No zero-float conflicts identified in this window.'}`,
  };
}

// ── Shared Ritz CSS ────────────────────────────────────────────────────────

const RITZ_BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1a1a; font-size: 9.5px; background: #fff; }
  .ritz-serif { font-family: 'Cormorant Garamond', Georgia, serif; }
  .navy { color: #0F1B33; }
  .gold { color: #C9A96E; }
  .gold-bg { background: #C9A96E; }
  .navy-bg { background: #0F1B33; }
`;

function sectionItemsHtml(items: ExecutiveSectionItem[]): string {
  if (!items.length) {
    return `<div class="empty-section">No major items in this category for the reporting window.</div>`;
  }
  return items
    .map(
      (item) => `
    <div class="op-item">
      <div class="op-title">${esc(item.title)}</div>
      <div class="op-desc">${esc(item.description)}</div>
    </div>`
    )
    .join('');
}

// ── Executive Look-Ahead ───────────────────────────────────────────────────

export function buildExecutiveLookaheadHtml(input: LookAheadPdfInput): string {
  const projTitle = projectDisplayTitle(input.projectName, input.projectNumber);
  const residence = residenceLine(input.client, input.projectName);
  const windowLabel = fmtWindowRange(input.windowStart, input.windowEnd);
  const { executive: ex } = input;

  const statusClass =
    ex.status === 'ON TRACK' ? 'status-on-track' : ex.status === 'AT RISK' ? 'status-at-risk' : 'status-delayed';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
${RITZ_BASE_CSS}
  .page { width: 100%; min-height: 100vh; position: relative; padding-bottom: 48px; }
  .header { text-align: center; padding: 36px 48px 20px; border-bottom: 1px solid #e8e4dc; }
  .header .brand { font-size: 28px; font-weight: 600; letter-spacing: 8px; color: #0F1B33; text-transform: uppercase; }
  .header .subtitle { margin-top: 10px; font-size: 11px; letter-spacing: 2px; color: #666; text-transform: uppercase; }
  .header .gold-rule { width: 80px; height: 2px; background: #C9A96E; margin: 16px auto 0; }

  .status-block { margin: 24px 48px 0; padding: 18px 22px; background: linear-gradient(135deg, #faf9f7 0%, #fff 100%); border: 1px solid #e8e4dc; border-radius: 2px; }
  .status-row { display: flex; align-items: flex-start; gap: 16px; }
  .status-badge { flex-shrink: 0; padding: 6px 14px; font-size: 9px; font-weight: 700; letter-spacing: 2px; border-radius: 2px; }
  .status-on-track { background: #0F1B33; color: #C9A96E; }
  .status-at-risk { background: #8B4513; color: #fff; }
  .status-delayed { background: #8B0000; color: #fff; }
  .status-label { font-size: 8px; font-weight: 700; letter-spacing: 2px; color: #C9A96E; margin-bottom: 6px; }
  .status-text { font-size: 10.5px; line-height: 1.65; color: #333; }

  .section { margin: 22px 48px 0; }
  .section-title { font-size: 10px; font-weight: 700; letter-spacing: 3px; color: #0F1B33; text-transform: uppercase; padding-bottom: 8px; border-bottom: 2px solid #C9A96E; margin-bottom: 12px; }
  .op-item { margin-bottom: 14px; padding-left: 14px; border-left: 3px solid #C9A96E; }
  .op-title { font-size: 10.5px; font-weight: 600; color: #0F1B33; margin-bottom: 3px; }
  .op-desc { font-size: 9.5px; line-height: 1.55; color: #555; }
  .empty-section { font-size: 9px; color: #999; font-style: italic; }

  .owner-box { margin: 22px 48px 0; border: 2px solid #C9A96E; border-radius: 2px; overflow: hidden; }
  .owner-box-hdr { background: #0F1B33; color: #C9A96E; padding: 8px 16px; font-size: 9px; font-weight: 700; letter-spacing: 2px; }
  .owner-box-body { padding: 14px 16px; background: #fffdf8; }
  .owner-title { font-size: 11px; font-weight: 700; color: #0F1B33; margin-bottom: 8px; }
  .owner-meta { display: flex; gap: 24px; margin-bottom: 8px; font-size: 9px; }
  .owner-meta b { color: #0F1B33; }
  .owner-desc { font-size: 9.5px; line-height: 1.55; color: #444; }

  .brief { margin: 24px 48px 0; padding: 16px 18px; background: #f7f5f2; border-left: 4px solid #0F1B33; }
  .brief-title { font-size: 8px; font-weight: 700; letter-spacing: 2px; color: #C9A96E; margin-bottom: 6px; }
  .brief-text { font-size: 10px; line-height: 1.65; color: #333; font-style: italic; }

  .footer { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 48px; border-top: 1px solid #e8e4dc; display: flex; justify-content: center; font-size: 8px; color: #888; letter-spacing: 1px; text-transform: uppercase; }
</style></head><body>
<div class="page">
  <div class="header">
    <div class="brand ritz-serif">${esc(projTitle)}</div>
    <div class="subtitle">${esc(residence)} &nbsp;•&nbsp; Executive Look Ahead &nbsp;•&nbsp; ${esc(windowLabel)}</div>
    <div class="gold-rule"></div>
  </div>

  <div class="status-block">
    <div class="status-label">PROJECT STATUS</div>
    <div class="status-row">
      <div class="status-badge ${statusClass}">${esc(ex.status)}</div>
      <div class="status-text">${esc(ex.statusNarrative)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Site Operations</div>
    ${sectionItemsHtml(ex.siteOperations)}
  </div>

  <div class="section">
    <div class="section-title">Off-Site Production</div>
    ${sectionItemsHtml(ex.offSiteProduction)}
  </div>

  ${
    ex.ownerAction
      ? `
  <div class="owner-box">
    <div class="owner-box-hdr">Owner Action Required</div>
    <div class="owner-box-body">
      <div class="owner-title">${esc(ex.ownerAction.title)}</div>
      <div class="owner-meta">
        <span><b>DEADLINE</b> &nbsp;${esc(ex.ownerAction.deadline)}</span>
        <span><b>STATUS</b> &nbsp;${esc(ex.ownerAction.status)}</span>
      </div>
      <div class="owner-desc">${esc(ex.ownerAction.description)}</div>
    </div>
  </div>`
      : ''
  }

  <div class="brief">
    <div class="brief-title">Executive Brief</div>
    <div class="brief-text">${esc(ex.executiveBrief)}</div>
  </div>

  <div class="footer">
    Confidential &nbsp;•&nbsp; ${esc(projTitle)} &nbsp;•&nbsp; Prepared by ${esc(input.preparedBy)} &nbsp;•&nbsp; CPM Rev. ${esc(input.revision)}
  </div>
</div>
</body></html>`;
}

// ── Technical Look-Ahead ───────────────────────────────────────────────────

function renderActivityRow(act: LookAheadActivity, days: Date[]): string {
  const { cleanName } = extractAction(act.activityName);
  const id = (act.activityId || '').replace(/^LA-/, '');
  const barType = activityBarType(act);
  const isCritical = act.floatDays === 0 && act.status !== 'done';
  const dur = act.remainingDuration || act.originalDuration || '—';
  const tf =
    act.status === 'done' ? '—' : act.floatDays === 0 ? `<span class="tf-zero">0d</span>` : `${act.floatDays}d`;

  const dayCells = days
    .map((day) => {
      const active = dayInRange(day, act.startDate, act.finishDate);
      const bg = active ? barColor(barType) : 'transparent';
      const border = active ? '' : 'border:1px solid #eee;';
      return `<td class="day-cell" style="background:${bg};${border}"></td>`;
    })
    .join('');

  return `<tr class="${isCritical ? 'row-critical' : ''}">
    <td class="col-id">${esc(id)}</td>
    <td class="col-act">${esc(cleanName)}</td>
    <td class="col-d">${fmtShort(act.startDate)}</td>
    <td class="col-d">${fmtShort(act.finishDate)}</td>
    <td class="col-d">${dur}</td>
    <td class="col-st ${barType}">${statusCode(act.status)}</td>
    <td class="col-tf">${tf}</td>
    ${dayCells}
  </tr>`;
}

function renderSectionHeader(section: string, colSpan: number): string {
  return `<tr class="section-row"><td colspan="${colSpan}">◆ &nbsp;${esc(section)}</td></tr>`;
}

function splitGroupsAtRowLimit(
  groups: { section: string; items: LookAheadActivity[] }[],
  limit: number
): [{ section: string; items: LookAheadActivity[] }[], { section: string; items: LookAheadActivity[] }[]] {
  const page1: { section: string; items: LookAheadActivity[] }[] = [];
  const page2: { section: string; items: LookAheadActivity[] }[] = [];
  let count = 0;

  for (const group of groups) {
    const need = 1 + group.items.length;
    if (count + need <= limit) {
      page1.push(group);
      count += need;
      continue;
    }
    if (count < limit) {
      const room = limit - count - 1;
      if (room > 0) {
        page1.push({ section: group.section, items: group.items.slice(0, room) });
        const rest = group.items.slice(room);
        if (rest.length) page2.push({ section: group.section, items: rest });
      } else {
        page2.push(group);
      }
      count = limit;
      continue;
    }
    page2.push(group);
  }

  return [page1, page2];
}

function renderTechnicalTable(
  groups: { section: string; items: LookAheadActivity[] }[],
  days: Date[],
  showHeader = true
): string {
  const dayHeaders = days
    .map(
      (d, i) =>
        `<th class="day-hdr"><div class="day-num">${String(i + 1).padStart(2, '0')}</div><div class="day-lbl">${d.getDate()}</div></th>`
    )
    .join('');

  let body = '';
  for (const group of groups) {
    body += renderSectionHeader(group.section, 7 + days.length);
    for (const act of group.items) {
      body += renderActivityRow(act, days);
    }
  }

  const headerRow = showHeader
    ? `<thead>
      <tr>
        <th class="col-id">ID</th>
        <th class="col-act">ACTIVITY</th>
        <th class="col-d">START</th>
        <th class="col-d">FINISH</th>
        <th class="col-d">DUR</th>
        <th class="col-st">STATUS</th>
        <th class="col-tf">TF</th>
        ${dayHeaders}
      </tr>
    </thead>`
    : '';

  return `<table class="tech-table">${headerRow}<tbody>${body}</tbody></table>`;
}

export function buildTechnicalLookaheadHtml(input: LookAheadPdfInput): string {
  const projTitle = projectDisplayTitle(input.projectName, input.projectNumber);
  const residence = residenceLine(input.client, input.projectName).toUpperCase();
  const days = buildDayColumns(input.windowStart);
  const groups = groupBySection(input.activities);
  const { starts, finishes, continues, critical } = classifyActivities(
    input.activities,
    input.windowStart,
    input.windowEnd
  );

  const activeFloats = input.activities
    .filter((a) => a.status !== 'done')
    .map((a) => a.floatDays);
  const tightestFloat = activeFloats.length ? Math.min(...activeFloats) : null;

  const ownerMilestone = input.activities.find(
    (a) =>
      (a.activityId || '').toUpperCase().startsWith('M-') ||
      a.activityName.toUpperCase().includes('OWNER')
  );
  const ownerKpi = ownerMilestone?.finishDate
    ? `${fmtMonthDayShort(ownerMilestone.finishDate).toUpperCase()} OWNER LOCK`
    : ownerMilestone
      ? 'OWNER DECISION'
      : '—';

  const inventoryAct = input.activities.find((a) =>
    /floor|inventory|material|stock/i.test(a.activityName)
  );
  const inventoryKpi = inventoryAct
    ? inventoryAct.activityName.split('—')[0].trim().substring(0, 22).toUpperCase()
    : 'MATERIAL STATUS';

  const scheduleStatus =
    critical.length >= 2 ? 'AT RISK' : critical.length === 1 ? 'MONITOR' : 'ON TRACK';

  const criticalFocus = critical.slice(0, 4).map((a) => {
    const { cleanName } = extractAction(a.activityName);
    return `<div class="focus-item">
      <div class="focus-id">${esc((a.activityId || '').replace(/^LA-/, ''))}</div>
      <div class="focus-name">${esc(cleanName.split('—')[0].trim())}</div>
      <div class="focus-dates">${fmtShort(a.startDate)} – ${fmtShort(a.finishDate)} · TF 0d</div>
    </div>`;
  }).join('') || '<div class="focus-empty">No zero-float activities in window.</div>';

  const [page1Groups, page2Groups] = splitGroupsAtRowLimit(groups, 18);
  const tablePage1 = renderTechnicalTable(page1Groups, days, true);

  const page2Html = page2Groups.length
    ? `
    <div class="page page-break">
      <div class="tech-header compact">
        <div class="tech-brand">${esc(projTitle)}</div>
        <div class="tech-sub">EXECUTIVE TECHNICAL LOOKAHEAD &nbsp;|&nbsp; ${esc(residence)}</div>
      </div>
      ${renderTechnicalTable(page2Groups, days, true)}
      <div class="tech-footer">
        ${esc(projTitle)} &nbsp;|&nbsp; EXECUTIVE TECHNICAL LOOKAHEAD &nbsp;|&nbsp; REV. ${esc(input.revision)} &nbsp;|&nbsp; CONFIDENTIAL &nbsp;|&nbsp; PREPARED BY ${esc(input.preparedBy.toUpperCase())} (PDG)
      </div>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
${RITZ_BASE_CSS}
  .page { width: 100%; min-height: 100vh; position: relative; padding-bottom: 36px; }
  .page-break { page-break-before: always; }

  .tech-header { padding: 14px 20px 10px; border-bottom: 3px solid #C9A96E; }
  .tech-header.compact { padding: 10px 20px 8px; }
  .tech-brand { font-size: 14px; font-weight: 700; letter-spacing: 4px; color: #0F1B33; }
  .tech-sub { font-size: 8px; letter-spacing: 2px; color: #666; margin-top: 3px; }

  .meta-bar { display: flex; gap: 0; background: #0F1B33; color: #fff; font-size: 7.5px; }
  .meta-item { flex: 1; padding: 7px 12px; border-right: 1px solid #1B2A4A; }
  .meta-item:last-child { border-right: none; }
  .meta-label { color: #C9A96E; font-weight: 700; letter-spacing: 1px; margin-bottom: 2px; }
  .meta-value { font-weight: 500; }

  .kpi-row { display: flex; gap: 0; border-bottom: 1px solid #ddd; }
  .kpi { flex: 1; text-align: center; padding: 10px 6px; border-right: 1px solid #eee; }
  .kpi:last-child { border-right: none; }
  .kpi-num { font-size: 18px; font-weight: 800; color: #0F1B33; line-height: 1; }
  .kpi-num.small { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
  .kpi-lbl { font-size: 6.5px; font-weight: 600; letter-spacing: 1px; color: #777; margin-top: 4px; text-transform: uppercase; }

  .legend { display: flex; gap: 14px; padding: 6px 20px; font-size: 7px; color: #555; border-bottom: 1px solid #eee; flex-wrap: wrap; }
  .leg-item { display: flex; align-items: center; gap: 4px; }
  .leg-swatch { width: 12px; height: 8px; border-radius: 1px; }

  .main-layout { display: flex; gap: 0; padding: 8px 12px 0; }
  .table-wrap { flex: 1; overflow: hidden; }
  .focus-panel { width: 148px; flex-shrink: 0; margin-left: 8px; }
  .focus-box { border: 2px solid #8B0000; border-radius: 2px; background: #fff8f8; }
  .focus-hdr { background: #8B0000; color: #fff; padding: 6px 8px; font-size: 7px; font-weight: 700; letter-spacing: 1.5px; }
  .focus-body { padding: 8px; }
  .focus-item { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #f0d0d0; }
  .focus-item:last-child { border-bottom: none; margin-bottom: 0; }
  .focus-id { font-size: 8px; font-weight: 700; color: #8B0000; }
  .focus-name { font-size: 8px; font-weight: 600; color: #0F1B33; margin-top: 2px; line-height: 1.3; }
  .focus-dates { font-size: 7px; color: #666; margin-top: 2px; }
  .focus-empty { font-size: 7.5px; color: #888; font-style: italic; }

  .tech-table { width: 100%; border-collapse: collapse; font-size: 7px; }
  .tech-table th { background: #0F1B33; color: #fff; padding: 4px 3px; font-weight: 700; letter-spacing: 0.3px; border: 1px solid #0a1225; text-align: center; }
  .tech-table th.col-act, .tech-table td.col-act { text-align: left; }
  .tech-table td { padding: 3px 4px; border: 1px solid #e5e5e5; vertical-align: middle; }
  .tech-table tr:nth-child(even):not(.section-row) td { background: #fafafa; }
  .tech-table tr.row-critical td.col-act { color: #8B0000; font-weight: 700; }
  .tech-table tr.section-row td { background: #f0ebe3; font-weight: 700; font-size: 7.5px; color: #0F1B33; letter-spacing: 0.5px; padding: 5px 8px; border: 1px solid #ddd; }
  .col-id { width: 34px; font-weight: 600; text-align: center; }
  .col-act { min-width: 120px; max-width: 160px; }
  .col-d { width: 34px; text-align: center; }
  .col-st { width: 30px; text-align: center; font-weight: 700; font-size: 6.5px; }
  .col-st.critical, .col-st.owner { color: #8B0000; }
  .col-st.ip { color: #1F4E79; }
  .col-tf { width: 24px; text-align: center; }
  .tf-zero { color: #8B0000; font-weight: 800; }
  .day-hdr { width: 18px; padding: 2px 1px !important; }
  .day-num { font-size: 7px; font-weight: 700; }
  .day-lbl { font-size: 6px; color: #C9A96E; font-weight: 400; }
  .day-cell { width: 18px; height: 14px; padding: 0 !important; }

  .tech-footer { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 20px; border-top: 1px solid #ddd; font-size: 7px; color: #888; letter-spacing: 0.8px; text-align: center; text-transform: uppercase; }
</style></head><body>

<div class="page">
  <div class="tech-header">
    <div class="tech-brand">${esc(projTitle)}</div>
    <div class="tech-sub">EXECUTIVE TECHNICAL LOOKAHEAD &nbsp;|&nbsp; ${esc(residence)}</div>
  </div>

  <div class="meta-bar">
    <div class="meta-item"><div class="meta-label">REPORTING WINDOW</div><div class="meta-value">${esc(fmtWindowRangeUpper(input.windowStart, input.windowEnd))}</div></div>
    <div class="meta-item"><div class="meta-label">DATA DATE</div><div class="meta-value">${esc(fmtMonthDayShort(input.dataDate))}</div></div>
    <div class="meta-item"><div class="meta-label">SCHEDULE STATUS</div><div class="meta-value">${scheduleStatus}</div></div>
    <div class="meta-item"><div class="meta-label">REFERENCE</div><div class="meta-value">CPM Rev. ${esc(input.revision)}</div></div>
  </div>

  <div class="kpi-row">
    <div class="kpi"><div class="kpi-num">${starts.length}</div><div class="kpi-lbl">Activities Starting</div></div>
    <div class="kpi"><div class="kpi-num">${finishes.length}</div><div class="kpi-lbl">Finishing</div></div>
    <div class="kpi"><div class="kpi-num">${continues.length}</div><div class="kpi-lbl">Continuing</div></div>
    <div class="kpi"><div class="kpi-num">${tightestFloat !== null ? `${tightestFloat}d` : '—'}</div><div class="kpi-lbl">Tightest Float</div></div>
    <div class="kpi"><div class="kpi-num small">${esc(ownerKpi)}</div><div class="kpi-lbl">Owner Milestone</div></div>
    <div class="kpi"><div class="kpi-num small">${esc(inventoryKpi)}</div><div class="kpi-lbl">Materials</div></div>
  </div>

  <div class="legend">
    <div class="leg-item"><span class="leg-swatch" style="background:#8B0000"></span> Critical Path</div>
    <div class="leg-item"><span class="leg-swatch" style="background:#1F4E79"></span> In Progress</div>
    <div class="leg-item"><span class="leg-swatch" style="background:#9ca3af"></span> Pending</div>
    <div class="leg-item"><span class="leg-swatch" style="background:#C9A96E"></span> Owner Decision</div>
  </div>

  <div class="main-layout">
    <div class="table-wrap">${tablePage1}</div>
    <div class="focus-panel">
      <div class="focus-box">
        <div class="focus-hdr">CRITICAL FOCUS</div>
        <div class="focus-body">${criticalFocus}</div>
      </div>
    </div>
  </div>

  <div class="tech-footer">
    ${esc(projTitle)} &nbsp;|&nbsp; EXECUTIVE TECHNICAL LOOKAHEAD &nbsp;|&nbsp; REV. ${esc(input.revision)} &nbsp;|&nbsp; CONFIDENTIAL &nbsp;|&nbsp; PREPARED BY ${esc(input.preparedBy.toUpperCase())} (${GC_NAME_UPPER.includes('PDG') ? 'PDG' : 'PM'})
  </div>
</div>

${page2Html}

</body></html>`;
}

export function lookaheadPdfFilename(
  type: 'executive' | 'technical',
  projectNumber: string,
  revision: string,
  windowStart: Date
): string {
  const dateStr = windowStart.toISOString().slice(5, 10).replace('-', '');
  const proj = projectNumber || 'LA';
  const rev = revision || '';
  const prefix = type === 'executive' ? 'Executive' : 'Technical';
  return `${dateStr}_${proj}_${prefix}_LookAhead_${rev}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
}
