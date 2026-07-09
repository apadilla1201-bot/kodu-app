/**
 * Ritz look-ahead annex PDFs — pixel-matched to Meeting 07 reference annexes.
 */
// ── Reference palette (Meeting 07 annexes) ─────────────────────────────────
const C = {
  cream: '#FDFBF7',
  creamTech: '#F9F7F2',
  beige: '#F2EEE4',
  beigeMeta: '#EDE8DC',
  gold: '#C5A059',
  goldDark: '#B89B5E',
  charcoal: '#2D2D2D',
  charcoalDark: '#1E1E1E',
  text: '#333333',
  textMuted: '#888888',
  textLight: '#AAAAAA',
  green: '#38761D',
  greenBar: '#7D8E7D',
  purple: '#6B4E71',
  brick: '#A84448',
  blue: '#94A9C0',
  blueBar: '#8E9EB2',
  greyBar: '#C8C8C8',
  briefBg: '#F2F2F2',
  divider: '#E0E0E0',
  white: '#FFFFFF',
};

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

export type TechnicalFocusItem = { heading: string; title: string; body: string };

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
  return name || 'A. Padilla';
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
  const critical = act.floatDays <= 1 && act.status !== 'done';
  const owner = name.includes('OWNER') || id.startsWith('M-') || name.includes('STONE LOCK');
  if (owner || critical || name.includes('DEMO') || name.includes('COR') || id.startsWith('COR')) {
    return 'Owner Decisions & Critical Path';
  }
  if (
    name.includes('ELECTR') ||
    name.includes('HVAC') ||
    name.includes('LUTRON') ||
    name.includes('LOW VOLT') ||
    name.includes('DUCTWORK') ||
    name.includes('SOUND') ||
    name.includes('AUTOMATION')
  ) {
    return 'Building Systems Engineering & Rough-In';
  }
  if (
    id.startsWith('S-') ||
    id.startsWith('B-') ||
    name.includes('FABRICAT') ||
    name.includes('HARDWOOD') ||
    name.includes('MILLWORK') ||
    name.includes('PROCUREMENT')
  ) {
    return 'Procurement, Fabrication & Supply Logistics';
  }
  return 'Interior Architecture & Field Operations';
}

function classifyActivities(activities: LookAheadActivity[], windowStart: Date, windowEnd: Date) {
  const starts: LookAheadActivity[] = [];
  const finishes: LookAheadActivity[] = [];
  const continues: LookAheadActivity[] = [];
  const critical: LookAheadActivity[] = [];

  for (const act of activities) {
    const { action } = extractAction(act.activityName);
    if (act.floatDays <= 1 && act.status !== 'done') critical.push(act);

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

function technicalStatus(act: LookAheadActivity, windowStart: Date): string {
  const name = act.activityName.toUpperCase();
  if (name.includes('OWNER') && act.status === 'ip') return 'OWNER / IN PROG';
  if (act.floatDays <= 1 && act.status !== 'done') return 'CRITICAL';
  if (act.floatDays >= 2 && act.floatDays <= 14 && act.status !== 'done') return 'WATCH';
  if (act.status === 'ip') return 'IN PROG';
  if (act.startDate && act.startDate > windowStart) return 'UPCOMING';
  return 'PENDING';
}

function statusBadgeClass(st: string): string {
  if (st.includes('OWNER')) return 'st-owner';
  if (st === 'CRITICAL') return 'st-critical';
  if (st === 'WATCH') return 'st-watch';
  if (st === 'IN PROG') return 'st-ip';
  if (st === 'UPCOMING' || st === 'PENDING') return 'st-pend';
  return 'st-pend';
}

function ganttColor(act: LookAheadActivity, windowStart: Date): string {
  const st = technicalStatus(act, windowStart);
  if (st.includes('OWNER')) return C.purple;
  if (st === 'CRITICAL') return C.goldDark;
  if (st === 'IN PROG') return C.greenBar;
  if (st === 'WATCH') return C.goldDark;
  if (act.status === 'done') return C.greyBar;
  return C.blueBar;
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
    'Owner Decisions & Critical Path',
    'Interior Architecture & Field Operations',
    'Building Systems Engineering & Rough-In',
    'Procurement, Fabrication & Supply Logistics',
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
  return {
    title: parts[0] || cleanName,
    description: parts[1] || act.notes || '',
  };
}

export function buildFallbackExecutiveContent(
  input: Pick<LookAheadPdfInput, 'activities' | 'windowStart' | 'windowEnd' | 'tcoDate'>
): ExecutiveContent {
  const siteActs = input.activities.filter((a) => inferTechnicalSection(a) === 'Interior Architecture & Field Operations');
  const offSiteActs = input.activities.filter((a) =>
    ['Procurement, Fabrication & Supply Logistics', 'Building Systems Engineering & Rough-In'].includes(
      inferTechnicalSection(a)
    )
  );
  const ownerActs = input.activities.filter(
    (a) => inferTechnicalSection(a) === 'Owner Decisions & Critical Path' && /owner|stone|lock/i.test(a.activityName)
  );

  const { critical } = classifyActivities(input.activities, input.windowStart, input.windowEnd);
  const status: ExecutiveContent['status'] = critical.length >= 3 ? 'AT RISK' : 'ON TRACK';

  const ownerAct = ownerActs[0];
  const ownerAction = ownerAct
    ? {
        title: extractAction(ownerAct.activityName).cleanName.split('—')[0].trim(),
        deadline: ownerAct.finishDate ? fmtMonthDay(ownerAct.finishDate) : 'This window',
        status: 'IN PROGRESS – AWAITING LOCK',
        description:
          ownerAct.notes ||
          'This is the single most time-sensitive decision on the horizon and currently sits on the critical path with zero float. Locking your selection releases the marble submittals, book-matching and fabrication sequence. Any delay moves the finish schedule directly.',
      }
    : null;

  return {
    status,
    statusNarrative:
      status === 'ON TRACK'
        ? 'The residence transitions from demolition and protection into active interior construction.'
        : 'Schedule sensitivity is elevated — critical-path activities require immediate coordination.',
    siteOperations: siteActs.slice(0, 3).map(itemFromActivity),
    offSiteProduction: offSiteActs.slice(0, 3).map(itemFromActivity),
    ownerAction,
    executiveBrief:
      'This is the turning point where the residence moves from clearing space to building it. Demolition closes out, framing defines every room, and the building systems begin to take their place inside the walls. The one action that keeps the premium finishes on schedule is locking the stone selection by July 9.',
  };
}

export function buildFallbackTechnicalFocus(
  input: Pick<LookAheadPdfInput, 'activities' | 'windowStart' | 'windowEnd' | 'tcoDate'>
): TechnicalFocusItem[] {
  const items: TechnicalFocusItem[] = [];
  const owner = input.activities.find((a) => /owner|stone lock/i.test(a.activityName));
  if (owner) {
    items.push({
      heading: 'OWNER KEY DECISION (TF: 0D)',
      title: `${extractAction(owner.activityName).cleanName.split('—')[0].trim()} — Lock by ${fmtMonthDayShort(owner.finishDate)}`,
      body: 'On the critical path with zero float. Locking releases marble submittals, book-matching and fabrication. Any delay moves the finish schedule directly.',
    });
  }

  const demo = input.activities.find((a) => /demo|cor|protection/i.test(a.activityName) && a.floatDays <= 1);
  if (demo) {
    items.push({
      heading: 'CRITICAL PATH (TF: 0D)',
      title: `${extractAction(demo.activityName).cleanName.split('—')[0].trim()}`,
      body: 'Demolition/protection and approved change-order works must complete on schedule to release framing across the residence.',
    });
  }

  const framing = input.activities.find((a) => /framing|partition/i.test(a.activityName));
  if (framing) {
    items.push({
      heading: 'PHASE TRANSITION',
      title: 'Framing Launch — 2 Crews',
      body: `Partition framing begins ${fmtMonthDayShort(framing.startDate)} with two crews, defining every room and opening the walls for systems rough-in.`,
    });
  }

  const systems = input.activities.filter((a) => inferTechnicalSection(a).includes('Building Systems'));
  if (systems.length >= 2) {
    const minTf = Math.min(...systems.map((s) => s.floatDays));
    const maxTf = Math.max(...systems.map((s) => s.floatDays));
    items.push({
      heading: `COORDINATION WATCH (TF: ${minTf}–${maxTf}D)`,
      title: 'In-Wall Systems Trio',
      body: `Electrical, HVAC and AV/Lutron in-wall all launch ${fmtMonthDayShort(systems[0].startDate)} behind framing. Requires tight field sequencing, Kitchen/Master first.`,
    });
  }

  const proc = input.activities.filter((a) => inferTechnicalSection(a) === 'Procurement, Fabrication & Supply Logistics');
  if (proc.length) {
    items.push({
      heading: 'PROCUREMENT ASSURANCE',
      title: 'Kitchen & Hardwood Programs',
      body: 'Kitchen fabrication under pre-verification; premium hardwood order in its delivery cycle. Ample float maintained.',
    });
  }

  return items.slice(0, 5);
}

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Montserrat:wght@400;500;600;700&display=swap');`;

// ── Executive HTML (3-column Meeting 07 layout) ────────────────────────────

export function buildExecutiveLookaheadHtml(input: LookAheadPdfInput): string {
  const projTitle = projectDisplayTitle(input.projectName, input.projectNumber);
  const residence = residenceLine(input.client, input.projectName);
  const windowLabel = fmtWindowRange(input.windowStart, input.windowEnd);
  const prepared = formatPreparedBy(input.preparedBy);
  const { executive: ex } = input;
  const statusColor = ex.status === 'ON TRACK' ? C.green : ex.status === 'AT RISK' ? '#B8860B' : C.brick;

  const listItems = (items: ExecutiveSectionItem[]) =>
    items
      .map(
        (it, i) => `
      <div class="li${i < items.length - 1 ? ' bordered' : ''}">
        <div class="li-title">${esc(it.title)}</div>
        <div class="li-desc">${esc(it.description)}</div>
      </div>`
      )
      .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
${FONTS}
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Montserrat',Arial,sans-serif; background:${C.cream}; color:${C.text}; font-size:9.5px; line-height:1.5; }
  .page { padding:32px 40px 24px; min-height:10.2in; position:relative; }
  .hdr { text-align:center; margin-bottom:18px; }
  .brand { font-family:'Playfair Display',Georgia,serif; font-size:24px; font-weight:700; color:${C.charcoal}; letter-spacing:3px; }
  .sub { margin-top:6px; font-size:9px; color:${C.gold}; letter-spacing:1px; }
  .rule { width:100%; height:1px; background:${C.gold}; margin:14px 0 20px; }
  .grid { display:flex; gap:20px; align-items:stretch; }
  .col { flex:1; }
  .col-r { flex:0.95; }
  .status-box { background:${C.white}; border:1px solid ${C.divider}; padding:14px 16px; margin-bottom:18px; }
  .status-lbl { font-size:7px; font-weight:600; letter-spacing:2px; color:${C.textLight}; margin-bottom:6px; }
  .status-val { font-family:'Playfair Display',Georgia,serif; font-size:22px; font-weight:700; color:${statusColor}; margin-bottom:6px; }
  .status-desc { font-size:9px; color:${C.textMuted}; line-height:1.55; }
  .sec-hdr { font-size:8px; font-weight:700; letter-spacing:2px; color:${C.charcoal}; margin-bottom:10px; }
  .sec-site { border-left:2px solid ${C.gold}; padding-left:12px; }
  .sec-off { border-left:3px solid ${C.charcoal}; padding-left:12px; }
  .li { padding:8px 0; }
  .li.bordered { border-bottom:1px solid ${C.divider}; }
  .li-title { font-size:9.5px; font-weight:700; color:${C.charcoal}; margin-bottom:2px; }
  .li-desc { font-size:9px; color:${C.textMuted}; line-height:1.5; font-style:italic; }
  .owner { background:${C.charcoalDark}; color:${C.white}; padding:18px 16px; min-height:100%; }
  .owner-h { font-family:'Playfair Display',Georgia,serif; font-size:14px; color:${C.gold}; margin-bottom:12px; line-height:1.3; }
  .owner-t { font-size:10px; font-weight:700; margin-bottom:4px; }
  .owner-dl { font-size:9px; font-weight:600; margin-bottom:10px; }
  .owner-body { font-size:8.5px; line-height:1.6; color:#e8e8e8; margin-bottom:12px; }
  .owner-rule { height:1px; background:#444; margin-bottom:8px; }
  .owner-st { font-size:7.5px; font-weight:700; letter-spacing:1px; color:${C.gold}; }
  .brief { margin-top:20px; background:${C.briefBg}; padding:12px 16px; font-size:9px; line-height:1.65; color:${C.charcoal}; }
  .brief b { font-weight:700; }
  .foot { position:absolute; bottom:20px; right:40px; font-size:7px; color:${C.textLight}; letter-spacing:0.8px; }
</style></head><body>
<div class="page">
  <div class="hdr">
    <div class="brand">${esc(projTitle)}</div>
    <div class="sub">${esc(residence)} &nbsp;•&nbsp; Executive Look Ahead &nbsp;•&nbsp; ${esc(windowLabel)}</div>
  </div>
  <div class="rule"></div>

  <div class="grid">
    <div class="col">
      <div class="status-box">
        <div class="status-lbl">PROJECT STATUS</div>
        <div class="status-val">${esc(ex.status)}</div>
        <div class="status-desc">${esc(ex.statusNarrative)}</div>
      </div>
      <div class="sec-site">
        <div class="sec-hdr">SITE OPERATIONS</div>
        ${listItems(ex.siteOperations)}
      </div>
    </div>
    <div class="col">
      <div class="sec-off">
        <div class="sec-hdr">OFF-SITE PRODUCTION</div>
        ${listItems(ex.offSiteProduction)}
      </div>
    </div>
    <div class="col col-r">
      ${
        ex.ownerAction
          ? `
      <div class="owner">
        <div class="owner-h">Owner Action<br/>Required</div>
        <div class="owner-t">${esc(ex.ownerAction.title)}</div>
        <div class="owner-dl">Deadline: ${esc(ex.ownerAction.deadline)}</div>
        <div class="owner-body">${esc(ex.ownerAction.description)}</div>
        <div class="owner-rule"></div>
        <div class="owner-st">STATUS: ${esc(ex.ownerAction.status)}</div>
      </div>`
          : '<div class="owner"><div class="owner-h">Owner Action<br/>Required</div><div class="owner-body">No owner decisions in this window.</div></div>'
      }
    </div>
  </div>

  <div class="brief"><b>Executive Brief:</b> ${esc(ex.executiveBrief)}</div>
  <div class="foot">Confidential &nbsp;•&nbsp; Ritz Carlton ${esc(input.projectNumber)} &nbsp;•&nbsp; Prepared by ${esc(prepared)} &nbsp;•&nbsp; CPM Rev. ${esc(input.revision)}</div>
</div>
</body></html>`;
}

// ── Technical HTML ─────────────────────────────────────────────────────────

function countTableRows(groups: { section: string; items: LookAheadActivity[] }[]): number {
  return groups.reduce((sum, g) => sum + 1 + g.items.length, 0);
}

function renderActivityRow(act: LookAheadActivity, days: Date[], windowStart: Date): string {
  const { cleanName } = extractAction(act.activityName);
  const id = (act.activityId || '').replace(/^LA-/, '');
  const st = technicalStatus(act, windowStart);
  const tf = act.status === 'done' ? '—' : `${act.floatDays}d`;
  const color = ganttColor(act, windowStart);

  const dayCells = days
    .map((day) => {
      if (!dayInRange(day, act.startDate, act.finishDate)) return `<td class="dc"></td>`;
      return `<td class="dc on" style="background:${color};"></td>`;
    })
    .join('');

  return `<tr class="data-row">
    <td class="cid">${esc(id)}</td>
    <td class="cact">${esc(cleanName)}</td>
    <td class="cd">${fmtShort(act.startDate)}</td>
    <td class="cd">${fmtShort(act.finishDate)}</td>
    <td class="cst"><span class="badge ${statusBadgeClass(st)}">${esc(st)}</span></td>
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

function renderTableHead(days: Date[]): string {
  const dayHdr = days.map((d) => `<th class="dh">${d.getDate()}</th>`).join('');
  return `<thead><tr>
    <th class="cid">ID</th><th class="cact">ACTIVITY DESCRIPTION</th>
    <th class="cd">START</th><th class="cd">FINISH</th><th class="cst">STATUS</th><th class="ctf">TF</th>
    ${dayHdr}
  </tr></thead>`;
}

function renderTableBody(
  groups: { section: string; items: LookAheadActivity[] }[],
  days: Date[],
  windowStart: Date
): string {
  const colSpan = 6 + days.length;
  let body = '';
  for (const g of groups) {
    body += `<tr class="sec"><td colspan="${colSpan}">◆ ${esc(g.section)}</td></tr>`;
    for (const act of g.items) body += renderActivityRow(act, days, windowStart);
  }
  return body;
}

function renderTable(
  groups: { section: string; items: LookAheadActivity[] }[],
  days: Date[],
  windowStart: Date,
  fullWidth = false
): string {
  const cls = fullWidth ? 'tbl tbl-full' : 'tbl';
  return `<table class="${cls}">${renderTableHead(days)}<tbody>${renderTableBody(groups, days, windowStart)}</tbody></table>`;
}

function renderFootbar(projectNumber: string, revision: string, prepared: string): string {
  return `<div class="footbar">
    <span>RITZ CARLTON PRIVATE RESIDENCES — ${esc(projectNumber)}</span>
    <span>EXECUTIVE TECHNICAL LOOK AHEAD &nbsp;|&nbsp; REV. ${esc(revision)}</span>
    <span>CONFIDENTIAL &nbsp;|&nbsp; PREPARED BY ${esc(prepared)} (PDG)</span>
  </div>`;
}

export function buildTechnicalLookaheadHtml(input: LookAheadPdfInput): string {
  const projTitle = projectDisplayTitle(input.projectName, input.projectNumber);
  const residence = residenceLine(input.client, input.projectName).toUpperCase();
  const prepared = formatPreparedBy(input.preparedBy).toUpperCase();
  const days = buildDayColumns(input.windowStart);
  const groups = groupBySection(input.activities);
  const { starts, continues, critical } = classifyActivities(
    input.activities,
    input.windowStart,
    input.windowEnd
  );

  const inWindow = input.activities.length;
  const activeFloats = input.activities.filter((a) => a.status !== 'done').map((a) => a.floatDays);
  const tightestFloat = activeFloats.length ? Math.min(...activeFloats) : 0;

  const ownerMilestone = input.activities.find((a) => /owner|stone lock/i.test(a.activityName));
  const ownerDate = ownerMilestone?.finishDate
    ? `${fmtMonthDayShort(ownerMilestone.finishDate).replace('.', '')}`
    : fmtMonthDayShort(input.windowEnd).replace('.', '');
  const ownerLabel = `${ownerDate}<br/><span class="own-sub">OWNER STONE LOCK</span>`;

  const scheduleStatus = critical.length >= 3 ? '● At Risk' : '● On Track';
  const focus = input.technicalFocus?.length ? input.technicalFocus : buildFallbackTechnicalFocus(input);

  const focusHtml = focus
    .map((f) => {
      let hdrClass = 'fh-gold';
      if (f.heading.includes('OWNER')) hdrClass = 'fh-purple';
      else if (f.heading.includes('CRITICAL PATH')) hdrClass = 'fh-brick';
      else if (f.heading.includes('PHASE')) hdrClass = 'fh-grey';
      return `
    <div class="fi">
      <div class="fi-h ${hdrClass}">◆ ${esc(f.heading)}</div>
      <div class="fi-t">${esc(f.title)}</div>
      <div class="fi-b">${esc(f.body)}</div>
    </div>`;
    })
    .join('');

  const totalRows = countTableRows(groups);
  // ~19 data rows fit on page 1 with sidebar; beyond that, continue on page 2 full-width
  const page1RowBudget = 19;
  const needsPage2 = totalRows > page1RowBudget;
  const [page1Groups, page2Groups] = needsPage2
    ? splitGroupsAtRowLimit(groups, page1RowBudget)
    : [groups, [] as { section: string; items: LookAheadActivity[] }[]];

  const table1 = renderTable(page1Groups, days, input.windowStart, false);

  const tcoNote = input.tcoDate
    ? `Note: TCO target milestone remains ${fmtMonthDay(input.tcoDate)}.`
    : 'Note: Period metrics aligned with Primavera P6 Master Schedule benchmarks.';

  const footbar = renderFootbar(input.projectNumber, input.revision, prepared);

  const page2 =
    page2Groups.length > 0
      ? `
<section class="continuation">
  <div class="cont-label">${esc(projTitle)} &nbsp;·&nbsp; Executive Technical Look Ahead — Continued</div>
  ${renderTable(page2Groups, days, input.windowStart, true)}
  ${footbar}
</section>`
      : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
${FONTS}
  @page { size: 17in 11in; margin: 5mm 4mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { font-family:'Montserrat',Arial,sans-serif; background:${C.creamTech}; color:${C.text}; font-size:7px; }
  .sheet { padding:0; }
  .hdr { border-bottom:2px solid ${C.gold}; padding-bottom:5px; margin-bottom:0; }
  .hdr-t { font-family:'Playfair Display',Georgia,serif; font-size:12px; font-weight:700; color:${C.charcoal}; letter-spacing:2px; }
  .hdr-s { font-size:6.5px; color:${C.gold}; letter-spacing:1.5px; margin-top:2px; font-weight:600; }
  .meta { display:flex; background:${C.beigeMeta}; border-bottom:1px solid ${C.divider}; font-size:6px; }
  .meta-i { flex:1; padding:5px 8px; border-right:1px solid ${C.divider}; }
  .meta-i:last-child { border-right:none; }
  .meta-l { font-weight:700; color:${C.charcoal}; margin-bottom:1px; }
  .meta-v { color:${C.text}; }
  .kpis { display:flex; border-bottom:1px solid ${C.divider}; }
  .kpi { flex:1; text-align:center; padding:6px 3px; border-right:1px solid ${C.divider}; background:${C.white}; }
  .kpi:last-child { border-right:none; }
  .kpi-n { font-family:'Playfair Display',Georgia,serif; font-size:17px; font-weight:700; color:${C.charcoal}; line-height:1; }
  .kpi-n.red { color:${C.brick}; }
  .kpi-n.purple { font-size:10px; color:${C.purple}; line-height:1.15; }
  .own-sub { font-size:5px; font-weight:700; letter-spacing:0.4px; display:block; margin-top:1px; }
  .kpi-l { font-size:4.8px; font-weight:600; letter-spacing:0.7px; color:${C.textMuted}; margin-top:2px; text-transform:uppercase; }
  .legend { display:flex; flex-wrap:wrap; gap:6px; align-items:center; padding:4px 8px; font-size:5.2px; color:${C.text}; border-bottom:1px solid ${C.divider}; background:${C.white}; }
  .sw { display:inline-block; width:9px; height:5px; margin-right:2px; vertical-align:middle; border-radius:1px; }
  .layout { display:flex; gap:7px; align-items:flex-start; margin-top:4px; }
  .tbl-wrap { flex:1; min-width:0; }
  .side { width:142px; flex-shrink:0; }
  .focus { border:1px solid ${C.divider}; background:${C.white}; }
  .focus-hdr { font-size:6.5px; font-weight:700; letter-spacing:1.2px; padding:4px 7px; border-bottom:1px solid ${C.divider}; color:${C.charcoal}; }
  .focus-body { padding:5px 7px; }
  .fi { margin-bottom:6px; padding-bottom:5px; border-bottom:1px solid ${C.divider}; }
  .fi:last-child { border-bottom:none; margin-bottom:0; padding-bottom:0; }
  .fi-h { font-size:5.2px; font-weight:700; letter-spacing:0.2px; margin-bottom:2px; }
  .fh-purple { color:${C.purple}; }
  .fh-brick { color:${C.brick}; }
  .fh-gold { color:${C.goldDark}; }
  .fh-grey { color:${C.charcoal}; }
  .fi-t { font-size:5.8px; font-weight:700; color:${C.charcoal}; line-height:1.25; margin-bottom:2px; }
  .fi-b { font-size:5.2px; color:${C.textMuted}; line-height:1.4; }
  .note { font-size:4.8px; color:${C.textLight}; font-style:italic; margin-top:5px; line-height:1.35; }
  .tbl { width:100%; border-collapse:collapse; table-layout:fixed; }
  .tbl-full { width:100%; }
  .tbl thead { display:table-header-group; }
  .tbl th { background:${C.beige}; color:${C.charcoal}; font-size:5.2px; font-weight:700; padding:3px 2px; border:1px solid ${C.divider}; text-align:center; letter-spacing:0.2px; }
  .tbl th.cact, .tbl td.cact { text-align:left; }
  .tbl td { border:1px solid ${C.divider}; padding:2px 2px; vertical-align:middle; font-size:5.2px; background:${C.white}; }
  .tbl tr.sec td { background:${C.beige}; font-weight:700; font-size:5.8px; color:${C.goldDark}; padding:3px 5px; font-style:italic; }
  .tbl tr.data-row { page-break-inside:avoid; break-inside:avoid; }
  .cid { width:24px; text-align:center; font-weight:700; }
  .cact { width:112px; line-height:1.2; }
  .cd { width:28px; text-align:center; font-size:4.8px; }
  .cst { width:40px; text-align:center; }
  .ctf { width:16px; text-align:center; font-weight:600; }
  .dh { width:14px; font-size:4.8px; }
  .dc { width:14px; height:9px; padding:0; }
  .dc.on { border:1px solid rgba(0,0,0,0.06); }
  .badge { display:inline-block; padding:1px 2px; border-radius:2px; font-size:4.2px; font-weight:700; letter-spacing:0.1px; line-height:1.15; white-space:nowrap; }
  .st-owner { color:${C.purple}; border:1px solid ${C.purple}; background:#f5f0f6; }
  .st-critical { color:${C.brick}; border:1px solid ${C.brick}; background:#fdf5f5; }
  .st-watch { color:${C.brick}; border:1px solid #c07070; background:#fdf8f5; }
  .st-ip { color:#5a6b4a; border:1px solid ${C.gold}; background:#faf8f2; }
  .st-pend { color:${C.blue}; border:1px solid ${C.blue}; background:#f4f7fa; }
  .footbar { display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding:6px 10px; background:${C.beige}; font-size:5.2px; color:${C.textMuted}; letter-spacing:0.4px; text-transform:uppercase; border-top:1px solid ${C.divider}; }
  .continuation { page-break-before:always; break-before:page; padding-top:0; margin-top:0; }
  .cont-label { font-size:5.5px; color:${C.textMuted}; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; padding-bottom:3px; border-bottom:1px solid ${C.divider}; }
</style></head><body>

<section class="sheet">
  <div class="hdr">
    <div class="hdr-t">${esc(projTitle)}</div>
    <div class="hdr-s">EXECUTIVE TECHNICAL LOOK AHEAD &nbsp;|&nbsp; ${esc(residence)}</div>
  </div>
  <div class="meta">
    <div class="meta-i"><div class="meta-l">Reporting Window</div><div class="meta-v">${esc(fmtWindowMeta(input.windowStart, input.windowEnd))}</div></div>
    <div class="meta-i"><div class="meta-l">Data Date</div><div class="meta-v">${esc(fmtMonthDayShort(input.dataDate))}, ${input.dataDate.getFullYear()}</div></div>
    <div class="meta-i"><div class="meta-l">Schedule Status</div><div class="meta-v">${scheduleStatus}</div></div>
    <div class="meta-i"><div class="meta-l">Reference</div><div class="meta-v">CPM Rev. ${esc(input.revision)}</div></div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-n">${inWindow}</div><div class="kpi-l">Activities in Window</div></div>
    <div class="kpi"><div class="kpi-n">${starts.length}</div><div class="kpi-l">Activities Starting</div></div>
    <div class="kpi"><div class="kpi-n">${continues.length}</div><div class="kpi-l">Continuing</div></div>
    <div class="kpi"><div class="kpi-n red">${critical.length}</div><div class="kpi-l">Critical in Window</div></div>
    <div class="kpi"><div class="kpi-n red">${tightestFloat}d</div><div class="kpi-l">Tightest Float</div></div>
    <div class="kpi"><div class="kpi-n purple">${ownerLabel}</div><div class="kpi-l">Owner Milestone</div></div>
  </div>
  <div class="legend">
    <span><span class="sw" style="background:${C.goldDark}"></span>Critical Path</span>
    <span><span class="sw" style="background:${C.greenBar}"></span>In Progress</span>
    <span><span class="sw" style="background:${C.blueBar}"></span>Pending / Upcoming</span>
    <span><span class="sw" style="background:${C.greyBar}"></span>Completed</span>
    <span><span class="sw" style="background:${C.purple}"></span>Owner Decision</span>
    <span><span class="sw" style="background:${C.brick}"></span>At Risk Focus</span>
    <span style="margin-left:4px;">TF = Total Float &nbsp;|&nbsp; 0–1d Critical &nbsp;|&nbsp; 2–14d Watch &nbsp;|&nbsp; &gt;14d Float</span>
  </div>
  <div class="layout">
    <div class="tbl-wrap">${table1}</div>
    <div class="side">
      <div class="focus">
        <div class="focus-hdr">CRITICAL FOCUS</div>
        <div class="focus-body">${focusHtml}</div>
      </div>
      <div class="note">${esc(tcoNote)} Period metrics aligned with Primavera P6 Master Schedule benchmarks.</div>
    </div>
  </div>
  ${page2Groups.length === 0 ? footbar : ''}
</section>
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
