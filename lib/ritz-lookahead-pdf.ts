/**
 * Ritz-style 2-Week Look-Ahead annex PDFs — Executive + Technical.
 * Layout aligned to RITZ_executive_lookahead / RITZ_technical_lookahead_luxury references.
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

export type ExecutiveSectionItem = { title: string; description: string };

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

export type TechnicalFocusItem = {
  heading: string;
  title: string;
  body: string;
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
  technicalFocus?: TechnicalFocusItem[];
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
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
}

function fmtShortSlash(d: Date | null): string {
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

function fmtWindowMeta(start: Date, end: Date): string {
  const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e} (14 Days)`;
}

export function extractAction(name: string): { cleanName: string; action: string } {
  const m = name.match(/\[([^\]]+)\]\s*$/);
  if (m) {
    return {
      cleanName: name.replace(/\s*\[[^\]]+\]\s*$/, '').replace(/^LA-/, '').trim(),
      action: m[1].toUpperCase(),
    };
  }
  return { cleanName: name.replace(/^LA-/, '').trim(), action: '' };
}

function formatPreparedBy(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}. ${parts[parts.length - 1]}`;
  return name || 'Project Manager';
}

function projectDisplayTitle(name: string, number: string): string {
  const upper = (name || 'PROJECT').toUpperCase();
  if (upper.includes('RITZ') && number) return `RITZ CARLTON ${number.toUpperCase()}`;
  if (number) return `${upper} ${number.toUpperCase()}`;
  return upper;
}

function residenceLine(client: string | null, projectName: string): string {
  if (client) return client;
  const m = projectName.match(/(.+?)\s*(?:residence|penthouse|suite)/i);
  return m ? `${m[1].trim()} Residence` : projectName;
}

function inferTechnicalSection(act: LookAheadActivity): string {
  const id = (act.activityId || '').toUpperCase();
  const name = act.activityName.toUpperCase();

  if (
    id.startsWith('M-') ||
    name.includes('OWNER') ||
    name.includes('MARBLE') && name.includes('LOCK') ||
    name.includes('STONE') && name.includes('LOCK') ||
    name.includes('SUBMITTAL') && name.includes('BOOK')
  ) {
    return 'Owner Decisions & Design Submittals';
  }
  if (name.includes('HARDWOOD') || name.includes('WOOD FLOOR') || name.includes('FLOOR SUPPLY') || name.includes('SHANNON')) {
    return 'Hardwood Flooring Program';
  }
  if (name.includes('SAUNA') || name.includes('WELLNESS') || name.includes('PLUNGE') || name.includes('SANCTUARY')) {
    return 'Private Wellness & Sanctuary Installations';
  }
  if (id.startsWith('S-') || name.includes('FABRICAT') || name.includes('PROCUREMENT') || name.includes('NII')) {
    return 'Procurement, Fabrication & Supply Logistics';
  }
  if (
    name.includes('ELECTR') ||
    name.includes('HVAC') ||
    name.includes('LUTRON') ||
    name.includes('LOW VOLT') ||
    name.includes('SPRINKLER') ||
    name.includes('DUCTWORK') ||
    name.includes('SOUND') ||
    name.includes('AUTOMATION')
  ) {
    return 'Building Systems Engineering & Infrastructure Rough-In';
  }
  if (id.startsWith('B-')) return 'Procurement, Fabrication & Supply Logistics';
  return 'Interior Architecture & Field Operations';
}

function classifyActivities(activities: LookAheadActivity[], windowStart: Date, windowEnd: Date) {
  const starts: LookAheadActivity[] = [];
  const finishes: LookAheadActivity[] = [];
  const continues: LookAheadActivity[] = [];
  const critical: LookAheadActivity[] = [];
  const watch: LookAheadActivity[] = [];

  for (const act of activities) {
    const { action } = extractAction(act.activityName);
    if (act.floatDays === 0 && act.status !== 'done') critical.push(act);
    if (act.floatDays > 0 && act.floatDays <= 5 && act.status !== 'done') watch.push(act);

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

  return { starts, finishes, continues, critical, watch };
}

function technicalStatus(act: LookAheadActivity, windowStart: Date): string {
  const name = act.activityName.toUpperCase();
  const notes = (act.notes || '').toUpperCase();
  if (name.includes('OWNER') && name.includes('LOCK')) return 'OWNER LOCK';
  if (idStartsWithM(act) && act.originalDuration === 0) return 'OWNER LOCK';
  if (notes.includes('PAID') || name.includes('PAID')) return 'PAID ✓';
  if (act.status === 'done') return 'DONE';
  if (act.status === 'ip') return 'IN PROG';
  if (act.floatDays <= 1 && act.floatDays >= 0 && act.status !== 'done') return 'WATCH';
  if (act.startDate && act.startDate > windowStart) return 'UPCOMING';
  return 'PENDING';
}

function idStartsWithM(act: LookAheadActivity): boolean {
  return (act.activityId || '').toUpperCase().startsWith('M-');
}

function barType(act: LookAheadActivity, windowStart: Date): 'critical' | 'ip' | 'pend' | 'owner' | 'done' {
  const st = technicalStatus(act, windowStart);
  if (st === 'OWNER LOCK') return 'owner';
  if (st === 'DONE' || st === 'PAID ✓') return 'done';
  if (st === 'WATCH' || (act.floatDays <= 1 && act.floatDays >= 0)) return 'critical';
  if (st === 'IN PROG') return 'ip';
  return 'pend';
}

function barColor(type: ReturnType<typeof barType>): string {
  const map: Record<string, string> = {
    critical: '#8B0000',
    watch: '#B45309',
    ip: '#1F4E79',
    owner: '#C9A96E',
    done: '#6b7280',
    pend: '#9ca3af',
  };
  return map[type] || '#9ca3af';
}

function overlapDays(act: LookAheadActivity, windowStart: Date, windowEnd: Date): number {
  if (!act.startDate) return 0;
  const s = new Date(act.startDate);
  const e = act.finishDate ? new Date(act.finishDate) : s;
  const wS = new Date(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate());
  const wE = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), windowEnd.getDate());
  const aS = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const aE = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  const start = aS > wS ? aS : wS;
  const end = aE < wE ? aE : wE;
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
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
  const order = [
    'Owner Decisions & Design Submittals',
    'Procurement, Fabrication & Supply Logistics',
    'Hardwood Flooring Program',
    'Private Wellness & Sanctuary Installations',
    'Interior Architecture & Field Operations',
    'Building Systems Engineering & Infrastructure Rough-In',
  ];
  const map = new Map<string, LookAheadActivity[]>();
  for (const act of activities) {
    const section = inferTechnicalSection(act);
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
  return {
    title,
    description: descParts.join(' ') || `Active ${fmtShortSlash(act.startDate)} – ${fmtShortSlash(act.finishDate)}.`,
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
    const s = inferTechnicalSection(a);
    return ![
      'Owner Decisions & Design Submittals',
      'Procurement, Fabrication & Supply Logistics',
    ].includes(s);
  });
  const offSiteActs = input.activities.filter((a) =>
    ['Procurement, Fabrication & Supply Logistics', 'Hardwood Flooring Program', 'Private Wellness & Sanctuary Installations'].includes(
      inferTechnicalSection(a)
    )
  );
  const ownerActs = input.activities.filter(
    (a) => inferTechnicalSection(a) === 'Owner Decisions & Design Submittals' || a.activityName.toUpperCase().includes('OWNER')
  );

  const status: ExecutiveContent['status'] = critical.length >= 2 ? 'AT RISK' : 'ON TRACK';
  const statusNarrative =
    status === 'ON TRACK'
      ? 'Schedule health remains stable as the residence advances through the current construction phase.'
      : 'Schedule sensitivity is elevated — critical-path activities require close coordination this period.';

  const ownerAct = ownerActs.find((a) => a.activityName.toUpperCase().includes('LOCK')) || ownerActs[0];
  const ownerAction = ownerAct
    ? {
        title: extractAction(ownerAct.activityName).cleanName.split('—')[0].trim(),
        deadline: ownerAct.finishDate ? fmtMonthDay(ownerAct.finishDate) : fmtMonthDay(input.windowEnd),
        status: 'AWAITING FINAL LOCK',
        description:
          ownerAct.notes ||
          'This is the pivotal decision of the period. Locking the selection immediately releases downstream fabrication and submittal sequences.',
      }
    : null;

  return {
    status,
    statusNarrative,
    siteOperations: siteActs.slice(0, 4).map(itemFromActivity),
    offSiteProduction: offSiteActs.slice(0, 4).map(itemFromActivity),
    ownerAction,
    executiveBrief: `The residence moves through its most active coordination window. ${starts.length} activities start, ${finishes.length} finish, and ${continues.length} continue in parallel. ${ownerAction ? `The single most important action is confirming ${ownerAction.title.toLowerCase()} by ${ownerAction.deadline.split(',')[0]}.` : 'Field and off-site production remain synchronized to the CPM baseline.'}`,
  };
}

export function buildFallbackTechnicalFocus(
  input: Pick<LookAheadPdfInput, 'activities' | 'windowStart' | 'windowEnd'>
): TechnicalFocusItem[] {
  const { critical, watch } = classifyActivities(input.activities, input.windowStart, input.windowEnd);
  const items: TechnicalFocusItem[] = [];

  const owner = input.activities.find((a) => idStartsWithM(a) || a.activityName.toUpperCase().includes('OWNER'));
  if (owner) {
    const { cleanName } = extractAction(owner.activityName);
    items.push({
      heading: 'OWNER KEY MILESTONE',
      title: `${cleanName.split('—')[0].trim()} — Lock by ${fmtMonthDayShort(owner.finishDate)}`,
      body: `Milestone ${owner.activityId} cascades the schedule if moved. Releases downstream submittals and fabrication.`,
    });
  }

  const tight = critical[0] || watch.sort((a, b) => a.floatDays - b.floatDays)[0];
  if (tight) {
    const { cleanName } = extractAction(tight.activityName);
    items.push({
      heading: `TIGHTEST CRITICAL PATH (TF: ${tight.floatDays}D)`,
      title: cleanName.split('—')[0].trim(),
      body: `${cleanName} shares only ${tight.floatDays} day${tight.floatDays === 1 ? '' : 's'} of float. Requires tight field sequencing.`,
    });
  }

  const systems = input.activities.filter((a) => inferTechnicalSection(a).includes('Building Systems'));
  if (systems.length >= 2) {
    items.push({
      heading: `COORDINATION WATCH (TF: ${Math.min(...systems.map((s) => s.floatDays))}D)`,
      title: 'In-Wall Systems Trio',
      body: 'Electrical, HVAC and low-voltage in-wall scopes launch behind framing. Requires coordinated trade sequencing.',
    });
  }

  const hardwood = input.activities.find((a) => inferTechnicalSection(a) === 'Hardwood Flooring Program');
  if (hardwood) {
    items.push({
      heading: 'PROCUREMENT ASSURANCE',
      title: 'Premium Hardwood Inventory',
      body: hardwood.notes || `${extractAction(hardwood.activityName).cleanName} — inventory and procurement status confirmed for the program.`,
    });
  }

  const wellness = input.activities.filter((a) => inferTechnicalSection(a) === 'Private Wellness & Sanctuary Installations');
  if (wellness.length) {
    items.push({
      heading: 'CUSTOM COMPONENT TRACKING',
      title: 'Wellness Area Components',
      body: `${wellness.length} wellness component${wellness.length > 1 ? 's' : ''} advancing off-site. Float maintained at ${Math.max(...wellness.map((w) => w.floatDays))}d.`,
    });
  }

  return items.slice(0, 6);
}

// ── Executive HTML ─────────────────────────────────────────────────────────

export function buildExecutiveLookaheadHtml(input: LookAheadPdfInput): string {
  const projTitle = projectDisplayTitle(input.projectName, input.projectNumber);
  const residence = residenceLine(input.client, input.projectName);
  const windowLabel = fmtWindowRange(input.windowStart, input.windowEnd);
  const prepared = formatPreparedBy(input.preparedBy);
  const { executive: ex } = input;

  const statusBg =
    ex.status === 'ON TRACK' ? '#0F1B33' : ex.status === 'AT RISK' ? '#8B4513' : '#8B0000';

  const sectionBlock = (title: string, items: ExecutiveSectionItem[]) => `
    <div class="section">
      <div class="section-hdr">${esc(title)}</div>
      ${items.length
        ? items
            .map(
              (it) => `
        <div class="item">
          <div class="item-title">${esc(it.title)}</div>
          <div class="item-desc">${esc(it.description)}</div>
        </div>`
            )
            .join('')
        : '<div class="item-desc muted">No major items this period.</div>'}
    </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',Arial,sans-serif; color:#222; background:#fff; font-size:10px; line-height:1.5; }
  .p1 { padding:40px 56px 32px; min-height:9.2in; }
  .p2 { page-break-before:always; min-height:10in; display:flex; align-items:flex-end; justify-content:center; padding:0 56px 48px; }
  .title-block { text-align:center; margin-bottom:28px; }
  .brand { font-family:'Cormorant Garamond',Georgia,serif; font-size:26px; font-weight:600; letter-spacing:6px; color:#0F1B33; text-transform:uppercase; }
  .subtitle { margin-top:8px; font-size:10px; letter-spacing:1.5px; color:#666; text-transform:none; }
  .status-wrap { margin-bottom:22px; }
  .status-label { font-size:8px; font-weight:700; letter-spacing:2px; color:#C9A96E; margin-bottom:8px; }
  .status-row { display:flex; gap:14px; align-items:flex-start; }
  .badge { flex-shrink:0; background:${statusBg}; color:#C9A96E; font-size:9px; font-weight:700; letter-spacing:2px; padding:5px 12px; }
  .status-text { font-size:10.5px; color:#333; line-height:1.6; padding-top:2px; }
  .section { margin-bottom:18px; }
  .section-hdr { font-size:9px; font-weight:700; letter-spacing:2.5px; color:#0F1B33; text-transform:uppercase; margin-bottom:10px; border-bottom:1.5px solid #C9A96E; padding-bottom:4px; }
  .item { margin-bottom:12px; }
  .item-title { font-size:10.5px; font-weight:700; color:#0F1B33; margin-bottom:2px; }
  .item-desc { font-size:10px; color:#555; line-height:1.55; max-width:520px; }
  .muted { color:#999; font-style:italic; }
  .owner { margin:20px 0; border:1.5px solid #C9A96E; padding:14px 16px; background:#fffdf8; }
  .owner-hdr { font-size:9px; font-weight:700; letter-spacing:2px; color:#0F1B33; margin-bottom:8px; }
  .owner-title { font-size:11px; font-weight:700; color:#0F1B33; margin-bottom:6px; }
  .owner-line { font-size:9.5px; color:#444; margin-bottom:3px; }
  .owner-status { font-size:9px; font-weight:700; letter-spacing:1px; color:#8B0000; margin-top:8px; }
  .brief { margin-top:18px; font-size:10px; line-height:1.65; color:#333; }
  .brief b { font-weight:700; color:#0F1B33; }
  .footer { font-size:8px; letter-spacing:1.2px; color:#888; text-transform:uppercase; text-align:center; }
</style></head><body>
<div class="p1">
  <div class="title-block">
    <div class="brand">${esc(projTitle)}</div>
    <div class="subtitle">${esc(residence)} &nbsp;•&nbsp; Executive Look Ahead &nbsp;•&nbsp; ${esc(windowLabel)}</div>
  </div>

  <div class="status-wrap">
    <div class="status-label">PROJECT STATUS</div>
    <div class="status-row">
      <div class="badge">${esc(ex.status)}</div>
      <div class="status-text">${esc(ex.statusNarrative)}</div>
    </div>
  </div>

  ${sectionBlock('Site Operations', ex.siteOperations)}
  ${sectionBlock('Off-Site Production', ex.offSiteProduction)}

  ${
    ex.ownerAction
      ? `
  <div class="owner">
    <div class="owner-hdr">Owner Action Required</div>
    <div class="owner-title">${esc(ex.ownerAction.title)}</div>
    <div class="owner-line">Deadline: ${esc(ex.ownerAction.deadline)}</div>
    <div class="owner-line">${esc(ex.ownerAction.description)}</div>
    <div class="owner-status">STATUS: ${esc(ex.ownerAction.status)}</div>
  </div>`
      : ''
  }

  <div class="brief"><b>Executive Brief:</b> ${esc(ex.executiveBrief)}</div>
</div>

<div class="p2">
  <div class="footer">Confidential &nbsp;•&nbsp; ${esc(projTitle.replace('RITZ CARLTON', 'Ritz Carlton'))} &nbsp;•&nbsp; Prepared by ${esc(prepared)} &nbsp;•&nbsp; CPM Rev. ${esc(input.revision)}</div>
</div>
</body></html>`;
}

// ── Technical HTML ─────────────────────────────────────────────────────────

function renderActivityRow(
  act: LookAheadActivity,
  days: Date[],
  windowStart: Date,
  windowEnd: Date
): string {
  const { cleanName } = extractAction(act.activityName);
  const id = (act.activityId || '').replace(/^LA-/, '');
  const dur = act.remainingDuration || act.originalDuration || 0;
  const st = technicalStatus(act, windowStart);
  const tf = act.status === 'done' || st === 'PAID ✓' ? '—' : `${act.floatDays}d`;
  const type = barType(act, windowStart);
  const overlap = overlapDays(act, windowStart, windowEnd);
  let labeled = false;

  const dayCells = days
    .map((day) => {
      const active = dayInRange(day, act.startDate, act.finishDate);
      if (!active) return `<td class="dc"></td>`;
      const bg = barColor(type);
      const label = !labeled && overlap > 0 ? `${overlap}d` : '';
      labeled = true;
      return `<td class="dc on" style="background:${bg};color:#fff;font-size:5.5px;font-weight:700;">${label}</td>`;
    })
    .join('');

  const nameHtml = esc(cleanName).replace(/\n/g, '<br/>');
  const rowClass = act.floatDays <= 1 && act.status !== 'done' ? 'watch' : '';

  return `<tr class="${rowClass}">
    <td class="cid">${esc(id)}</td>
    <td class="cact">${nameHtml}</td>
    <td class="cd">${fmtShortSlash(act.startDate)}</td>
    <td class="cd">${fmtShortSlash(act.finishDate)}</td>
    <td class="cd">${dur}d</td>
    <td class="cst">${esc(st)}</td>
    <td class="ctf">${tf}</td>
    ${dayCells}
  </tr>`;
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
      } else page2.push(group);
      count = limit;
      continue;
    }
    page2.push(group);
  }
  return [page1, page2];
}

function renderTable(
  groups: { section: string; items: LookAheadActivity[] }[],
  days: Date[],
  windowStart: Date,
  windowEnd: Date
): string {
  const dayHdr = days
    .map((_, i) => `<th class="dh">${String(i + 1).padStart(2, '0')}</th>`)
    .join('');
  let body = '';
  const colSpan = 7 + days.length;
  for (const g of groups) {
    body += `<tr class="sec"><td colspan="${colSpan}">◆ &nbsp;${esc(g.section)}</td></tr>`;
    for (const act of g.items) body += renderActivityRow(act, days, windowStart, windowEnd);
  }
  return `<table class="tbl">
    <thead><tr>
      <th class="cid">ID</th><th class="cact">ACTIVITY DESCRIPTION</th>
      <th class="cd">START</th><th class="cd">FINISH</th><th class="cd">DUR</th>
      <th class="cst">STATUS</th><th class="ctf">TF</th>${dayHdr}
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

export function buildTechnicalLookaheadHtml(input: LookAheadPdfInput): string {
  const projTitle = projectDisplayTitle(input.projectName, input.projectNumber);
  const residence = residenceLine(input.client, input.projectName).toUpperCase();
  const prepared = formatPreparedBy(input.preparedBy).toUpperCase();
  const days = buildDayColumns(input.windowStart);
  const groups = groupBySection(input.activities);
  const { starts, finishes, continues, critical } = classifyActivities(
    input.activities,
    input.windowStart,
    input.windowEnd
  );

  const activeFloats = input.activities.filter((a) => a.status !== 'done').map((a) => a.floatDays);
  const tightestFloat = activeFloats.length ? Math.min(...activeFloats) : null;

  const ownerMilestone = input.activities.find((a) => idStartsWithM(a) || /owner.*lock/i.test(a.activityName));
  const ownerKpi = ownerMilestone?.finishDate
    ? `${fmtMonthDayShort(ownerMilestone.finishDate).replace('.', '')} OWNER MARBLE LOCK`
    : 'OWNER MILESTONE';

  const inventoryAct =
    input.activities.find((a) => /wood floor|hardwood|inventory/i.test(a.activityName)) ||
    input.activities.find((a) => /paid|secure|funded/i.test(a.notes || ''));
  const inventoryKpi = inventoryAct
    ? inventoryAct.notes?.toUpperCase().includes('SECURE')
      ? 'Secure'
      : 'WOOD FLOOR INVENTORY'
    : 'MATERIAL STATUS';

  const scheduleStatus = critical.length >= 2 ? '● At Risk' : '● On Track';
  const focus = input.technicalFocus?.length ? input.technicalFocus : buildFallbackTechnicalFocus(input);

  const focusHtml = focus
    .map(
      (f) => `
    <div class="fi">
      <div class="fi-h">◆ ${esc(f.heading)}</div>
      <div class="fi-t">${esc(f.title)}</div>
      <div class="fi-b">${esc(f.body)}</div>
    </div>`
    )
    .join('');

  const [page1Groups, page2Groups] = splitGroupsAtRowLimit(groups, 14);
  const table1 = renderTable(page1Groups, days, input.windowStart, input.windowEnd);

  const page2 =
    page2Groups.length > 0
      ? `
  <div class="page brk">
    ${renderTable(page2Groups, days, input.windowStart, input.windowEnd)}
    <div class="foot">${esc(projTitle)} &nbsp; EXECUTIVE TECHNICAL LOOK AHEAD &nbsp;|&nbsp; REV. ${esc(input.revision)} &nbsp; CONFIDENTIAL &nbsp;|&nbsp; PREPARED BY ${esc(prepared)} (PDG)</div>
  </div>`
      : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',Arial,sans-serif; font-size:7px; color:#1a1a1a; background:#fff; }
  .page { padding:10px 12px 28px; position:relative; min-height:7.8in; }
  .brk { page-break-before:always; }
  .hdr { border-bottom:2.5px solid #C9A96E; padding-bottom:6px; margin-bottom:6px; }
  .hdr-t { font-size:11px; font-weight:800; letter-spacing:3px; color:#0F1B33; }
  .hdr-s { font-size:7px; letter-spacing:1.5px; color:#666; margin-top:2px; }
  .meta { font-size:7px; color:#333; margin-bottom:6px; line-height:1.6; }
  .meta b { color:#0F1B33; }
  .kpis { display:flex; border-top:1px solid #ccc; border-bottom:1px solid #ccc; margin-bottom:5px; }
  .kpi { flex:1; text-align:center; padding:7px 4px; border-right:1px solid #e5e5e5; }
  .kpi:last-child { border-right:none; }
  .kpi-n { font-size:16px; font-weight:800; color:#0F1B33; line-height:1; }
  .kpi-n.sm { font-size:9px; font-weight:700; letter-spacing:0.3px; }
  .kpi-l { font-size:5.5px; font-weight:600; letter-spacing:0.8px; color:#777; margin-top:3px; text-transform:uppercase; }
  .legend { font-size:6px; color:#555; margin-bottom:5px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  .sw { display:inline-block; width:10px; height:7px; margin-right:3px; vertical-align:middle; }
  .layout { display:flex; gap:8px; align-items:flex-start; }
  .tbl-wrap { flex:1; min-width:0; }
  .side { width:155px; flex-shrink:0; }
  .focus { border:1.5px solid #8B0000; background:#fffafa; }
  .focus-h { background:#8B0000; color:#fff; font-size:6.5px; font-weight:700; letter-spacing:1.5px; padding:5px 6px; }
  .focus-b { padding:6px; }
  .fi { margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #f0d8d8; }
  .fi:last-child { border-bottom:none; margin-bottom:0; }
  .fi-h { font-size:6px; font-weight:700; color:#8B0000; letter-spacing:0.5px; margin-bottom:2px; }
  .fi-t { font-size:6.5px; font-weight:700; color:#0F1B33; line-height:1.3; margin-bottom:2px; }
  .fi-b { font-size:6px; color:#444; line-height:1.45; }
  .note { font-size:5.5px; color:#888; font-style:italic; margin-top:6px; line-height:1.4; }
  .tbl { width:100%; border-collapse:collapse; table-layout:fixed; }
  .tbl th { background:#0F1B33; color:#fff; font-size:6px; font-weight:700; padding:3px 2px; border:1px solid #0a1225; text-align:center; }
  .tbl th.cact, .tbl td.cact { text-align:left; }
  .tbl td { border:1px solid #e0e0e0; padding:2px 3px; vertical-align:middle; font-size:6px; }
  .tbl tr.sec td { background:#ece6dc; font-weight:700; font-size:6.5px; color:#0F1B33; padding:4px 6px; }
  .tbl tr.watch td.cact { color:#8B0000; font-weight:700; }
  .cid { width:28px; text-align:center; font-weight:600; }
  .cact { width:130px; line-height:1.25; }
  .cd { width:30px; text-align:center; }
  .cst { width:38px; text-align:center; font-size:5.5px; font-weight:700; }
  .ctf { width:22px; text-align:center; }
  .dh { width:16px; }
  .dc { width:16px; height:12px; padding:0; }
  .dc.on { text-align:center; vertical-align:middle; }
  .foot { position:absolute; bottom:8px; left:12px; right:12px; text-align:center; font-size:6px; color:#888; letter-spacing:0.6px; text-transform:uppercase; border-top:1px solid #ddd; padding-top:6px; }
</style></head><body>
<div class="page">
  <div class="hdr">
    <div class="hdr-t">${esc(projTitle)}</div>
    <div class="hdr-s">EXECUTIVE TECHNICAL LOOK AHEAD &nbsp;|&nbsp; ${esc(residence)}</div>
  </div>
  <div class="meta">
    <b>Reporting Window:</b> ${esc(fmtWindowMeta(input.windowStart, input.windowEnd))} &nbsp;&nbsp;
    <b>Data Date:</b> ${esc(fmtMonthDayShort(input.dataDate))} &nbsp;&nbsp;
    <b>Schedule Status:</b> ${scheduleStatus} &nbsp;&nbsp;
    <b>Reference:</b> CPM Rev. ${esc(input.revision)}
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-n">${starts.length}</div><div class="kpi-l">Activities Starting</div></div>
    <div class="kpi"><div class="kpi-n">${finishes.length}</div><div class="kpi-l">Activities Finishing</div></div>
    <div class="kpi"><div class="kpi-n">${continues.length}</div><div class="kpi-l">Continuing</div></div>
    <div class="kpi"><div class="kpi-n">${tightestFloat !== null ? `${tightestFloat}d` : '—'}</div><div class="kpi-l">Tightest Float</div></div>
    <div class="kpi"><div class="kpi-n sm">${esc(ownerKpi)}</div><div class="kpi-l">Owner Milestone</div></div>
    <div class="kpi"><div class="kpi-n sm">${esc(inventoryKpi)}</div><div class="kpi-l">Materials</div></div>
  </div>
  <div class="legend">
    <span><span class="sw" style="background:#8B0000"></span>Critical Path</span>
    <span><span class="sw" style="background:#1F4E79"></span>In Progress</span>
    <span><span class="sw" style="background:#9ca3af"></span>Pending / Upcoming</span>
    <span><span class="sw" style="background:#C9A96E"></span>Owner Decision</span>
    <span style="margin-left:8px;">TF = Total Float &nbsp;|&nbsp; 0–1d = Critical &nbsp;|&nbsp; 2–5d = Watch &nbsp;|&nbsp; &gt;5d = Float Available</span>
  </div>
  <div class="layout">
    <div class="tbl-wrap">${table1}</div>
    <div class="side">
      <div class="focus">
        <div class="focus-h">CRITICAL FOCUS</div>
        <div class="focus-b">${focusHtml}</div>
      </div>
      <div class="note">Note: General project continuity metrics are fully aligned with Primavera P6 Master Schedule data benchmarks for current period transition.</div>
    </div>
  </div>
  ${page2Groups.length === 0 ? `<div class="foot">${esc(projTitle)} &nbsp; EXECUTIVE TECHNICAL LOOK AHEAD &nbsp;|&nbsp; REV. ${esc(input.revision)} &nbsp; CONFIDENTIAL &nbsp;|&nbsp; PREPARED BY ${esc(prepared)} (PDG)</div>` : ''}
</div>
${page2}
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
