/**
 * Weekly Field Report PDF — Ritz / PDG owner format (6 sections).
 */
import { downloadFileBuffer } from '@/lib/s3';
import { GC_ADDRESS_FULL, GC_NAME_UPPER } from '@/lib/gc-branding';
import { formatLogDate } from '@/lib/daily-log';
import { guessMimeType } from '@/lib/storage';
import { photoLocationLine, photoTagLabel } from '@/lib/site-photos';
import { createTranslator, type AppLocale } from '@/lib/i18n';

export type FieldReportPhoto = {
  id: string;
  fileName: string;
  cloudStoragePath: string;
  fileType: string | null;
  caption: string | null;
  area: string | null;
  trade: string | null;
  tag: string;
  takenAt: Date;
};

export type FieldReportLog = {
  id: string;
  logDate: Date;
  authorName: string;
  weather: string | null;
  temperature: string | null;
  workPerformed: string | null;
  crewNotes: string | null;
  deliveries: string | null;
  delays: string | null;
  status: string;
  photos: FieldReportPhoto[];
};

export type FieldReportRfi = {
  rfiNumber: string;
  subject: string;
  question?: string | null;
  status: string;
  priority: string;
  dateDue?: Date | null;
  assignedTo?: string | null;
  ballInCourt?: string | null;
};

export type FieldReportSubmittal = {
  submittalNumber: string;
  title: string;
  status: string;
  subcontractor: string | null;
  submittedDate: Date | null;
};

export type FieldReportMilestone = {
  title: string;
  bullets: string[];
};

export type FieldReportOpenItem = {
  num: number;
  item: string;
  deadline: string;
  responsible: string;
  priority: string;
};

export type FieldReportActionItem = {
  num: number;
  action: string;
  responsible: string;
  targetDate: string;
};

export type FieldReportData = {
  projectNumber: string;
  projectName: string;
  client: string | null;
  location: string | null;
  from: string;
  to: string;
  preparedBy: string;
  tcoTarget: string | null;
  overview: string;
  photoIntro: string | null;
  logs: FieldReportLog[];
  photosByDay: { date: string; label: string; photos: FieldReportPhoto[] }[];
  milestones: FieldReportMilestone[];
  openItems: FieldReportOpenItem[];
  actionItems: FieldReportActionItem[];
  openRfis: FieldReportRfi[];
};

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtRange(from: string, to: string): string {
  const f = new Date(`${from}T12:00:00`);
  const t = new Date(`${to}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  if (from === to) return f.toLocaleDateString('en-US', opts);
  return `${f.toLocaleDateString('en-US', opts)} – ${t.toLocaleDateString('en-US', opts)}`;
}

function fmtShortDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(`${d.slice(0, 10)}T12:00:00`) : d;
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtTitleDate(to: string): string {
  const t = new Date(`${to}T12:00:00`);
  return t.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function autoOverview(
  project: { projectName: string; client: string | null; location: string | null },
  logs: FieldReportLog[],
): string {
  const work = logs.map((l) => l.workPerformed?.trim()).filter(Boolean) as string[];
  const deliveries = logs.map((l) => l.deliveries?.trim()).filter(Boolean) as string[];
  const client = project.client ? ` · ${project.client}` : '';
  const loc = project.location ? `${project.location}. ` : '';
  const parts: string[] = [];
  if (work.length) parts.push(work.join(' '));
  if (deliveries.length) parts.push(`Deliveries / mobilization: ${deliveries.join('; ')}.`);
  const body = parts.length
    ? parts.join(' ')
    : 'Field activity documented in superintendent daily logs this reporting period.';
  return `${project.projectName}${client}. ${loc}${body}`;
}

export function autoPhotoIntro(): string {
  return 'Documentation of construction progress — site conditions, trade activity, and coordination captured during the reporting period.';
}

export function autoMilestones(
  submittals: FieldReportSubmittal[],
  logs: FieldReportLog[],
): FieldReportMilestone[] {
  const out: FieldReportMilestone[] = [];

  const activeSubs = submittals.filter((s) => s.status !== 'Draft' && s.status !== 'Rejected');
  if (activeSubs.length) {
    out.push({
      title: 'Submittals — Activity This Period',
      bullets: activeSubs.map((s) => {
        const who = s.subcontractor ? ` (${s.subcontractor})` : '';
        const when = s.submittedDate ? ` — submitted ${fmtShortDate(s.submittedDate)}` : '';
        return `${s.submittalNumber}: ${s.title}${who} — ${s.status}${when}`;
      }),
    });
  }

  const deliveryLogs = logs.filter((l) => l.deliveries?.trim());
  if (deliveryLogs.length) {
    out.push({
      title: 'Deliveries & Mobilization',
      bullets: deliveryLogs.map((l) => `${formatLogDate(l.logDate)}: ${l.deliveries!.trim()}`),
    });
  }

  const approved = logs.filter((l) => l.status === 'Approved' || l.status === 'Submitted');
  if (approved.length && !deliveryLogs.length && !activeSubs.length) {
    out.push({
      title: 'Field Progress',
      bullets: approved.map((l) => {
        const note = l.workPerformed?.trim() || 'Daily log submitted';
        return `${formatLogDate(l.logDate)}: ${note}`;
      }),
    });
  }

  return out;
}

export function autoOpenItems(rfis: FieldReportRfi[], logs: FieldReportLog[]): FieldReportOpenItem[] {
  const items: FieldReportOpenItem[] = [];
  let n = 1;

  for (const r of rfis) {
    const detail = r.question?.trim() ? ` — ${truncate(r.question, 100)}` : '';
    items.push({
      num: n++,
      item: `${r.rfiNumber}: ${r.subject}${detail}`,
      deadline: r.dateDue ? fmtShortDate(r.dateDue) : 'Ongoing',
      responsible: r.ballInCourt || r.assignedTo || 'Design / Owner',
      priority: r.priority || 'Normal',
    });
  }

  for (const l of logs) {
    if (!l.delays?.trim()) continue;
    items.push({
      num: n++,
      item: `Field issue (${formatLogDate(l.logDate)}): ${l.delays.trim()}`,
      deadline: 'Ongoing',
      responsible: l.authorName || 'PDG',
      priority: 'IN PROGRESS',
    });
  }

  return items;
}

export function autoActionItems(rfis: FieldReportRfi[], logs: FieldReportLog[]): FieldReportActionItem[] {
  const items: FieldReportActionItem[] = [];
  let n = 1;

  for (const r of rfis) {
    items.push({
      num: n++,
      action: `Respond to ${r.rfiNumber} — ${r.subject}`,
      responsible: r.ballInCourt || r.assignedTo || 'Design / Owner',
      targetDate: r.dateDue ? fmtShortDate(r.dateDue) : 'ASAP',
    });
  }

  for (const l of logs) {
    if (!l.delays?.trim()) continue;
    items.push({
      num: n++,
      action: `Resolve field delay / issue noted ${formatLogDate(l.logDate)}: ${truncate(l.delays.trim(), 140)}`,
      responsible: l.authorName || 'PDG',
      targetDate: 'Week of report',
    });
  }

  const nextWork = logs.filter((l) => l.workPerformed?.trim()).slice(-2);
  for (const l of nextWork) {
    if (items.length >= 8) break;
    items.push({
      num: n++,
      action: `Continue work in progress: ${truncate(l.workPerformed!.trim(), 120)}`,
      responsible: l.authorName || 'PDG / Trades',
      targetDate: 'Ongoing',
    });
  }

  return items;
}

export function formatTcoTarget(d: Date | null | undefined, locale: AppLocale = 'en'): string | null {
  if (!d) return null;
  const dateLocale = locale === 'es' ? 'es-US' : 'en-US';
  return d.toLocaleDateString(dateLocale, { month: 'long', day: 'numeric', year: 'numeric' });
}

async function photoToDataUrl(photo: FieldReportPhoto): Promise<string | null> {
  try {
    const buffer = await downloadFileBuffer(photo.cloudStoragePath);
    const mime = photo.fileType || guessMimeType(photo.fileName ?? 'photo.jpg', 'image/jpeg');
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

type PhotoWithData = FieldReportPhoto & { dataUrl: string | null };

async function embedPhotos(photos: FieldReportPhoto[]): Promise<PhotoWithData[]> {
  const out: PhotoWithData[] = [];
  for (const p of photos) {
    out.push({ ...p, dataUrl: await photoToDataUrl(p) });
  }
  return out;
}

function photoCaption(p: FieldReportPhoto, locale: AppLocale): string {
  const area = p.area?.trim();
  const cap = p.caption?.trim();
  if (area && cap) return `${area} — ${cap}`;
  if (cap) return cap;
  if (area) return area;
  const loc = photoLocationLine(p);
  if (loc) return loc;
  return photoTagLabel(p.tag, locale) || 'Site photo';
}

function fieldStatusBullet(log: FieldReportLog, locale: AppLocale): string {
  const dateLocale = locale === 'es' ? 'es-US' : 'en-US';
  const day = new Date(log.logDate).toLocaleDateString(dateLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const parts: string[] = [];
  if (log.workPerformed?.trim()) parts.push(log.workPerformed.trim());
  if (log.crewNotes?.trim()) parts.push(log.crewNotes.trim());
  if (log.deliveries?.trim()) parts.push(log.deliveries.trim());
  if (log.delays?.trim()) parts.push(`Delays / issues: ${log.delays.trim()}`);
  if (log.weather?.trim()) {
    parts.push(`Weather: ${log.weather}${log.temperature ? ` (${log.temperature})` : ''}`);
  }
  const text = parts.join(' ') || 'No field notes recorded for this day.';
  return `<li><strong>${esc(day)}:</strong> ${esc(text)}</li>`;
}

function photoCell(p: PhotoWithData, locale: AppLocale): string {
  const img = p.dataUrl
    ? `<img src="${p.dataUrl}" alt="" class="photo-img"/>`
    : `<div class="photo-missing">Image unavailable</div>`;
  return `
    <div class="photo-cell">
      ${img}
      <div class="photo-cap">${esc(photoCaption(p, locale))}</div>
    </div>`;
}

function milestonesHtml(milestones: FieldReportMilestone[]): string {
  if (!milestones.length) {
    return `<p class="dim">No milestones auto-detected this period — add submittal activity or note deliveries in daily logs.</p>`;
  }
  return milestones
    .map(
      (m) => `
    <div class="milestone-block">
      <div class="milestone-title">${esc(m.title)}</div>
      <ul class="milestone-list">${m.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </div>`,
    )
    .join('');
}

function openItemsTable(items: FieldReportOpenItem[]): string {
  if (!items.length) {
    return `<p class="dim">No open items or open RFIs in this period.</p>`;
  }
  return `
    <p class="table-note">Items marked URGENT are on the critical path. Timely Owner and Designer decisions protect the TCO target.</p>
    <table class="ritz-tbl">
      <thead>
        <tr><th>#</th><th>Item</th><th>Deadline</th><th>Responsible</th><th>Priority</th></tr>
      </thead>
      <tbody>
        ${items
          .map(
            (r) => `
          <tr>
            <td class="num">${r.num}</td>
            <td>${esc(r.item)}</td>
            <td>${esc(r.deadline)}</td>
            <td>${esc(r.responsible)}</td>
            <td>${esc(r.priority)}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

function actionItemsTable(items: FieldReportActionItem[]): string {
  if (!items.length) {
    return `<p class="dim">No action items generated — add RFIs or delays in daily logs to populate this section.</p>`;
  }
  return `
    <table class="ritz-tbl">
      <thead>
        <tr><th>#</th><th>Action</th><th>Responsible</th><th>Target Date</th></tr>
      </thead>
      <tbody>
        ${items
          .map(
            (r) => `
          <tr>
            <td class="num">${r.num}</td>
            <td>${esc(r.action)}</td>
            <td>${esc(r.responsible)}</td>
            <td>${esc(r.targetDate)}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

export async function buildFieldReportHtml(data: FieldReportData, locale: AppLocale = 'en'): Promise<string> {
  const t = createTranslator(locale);
  const pdf = (key: string, params?: Record<string, string | number | undefined>) =>
    t(`pdf.fieldReport.${key}`, params);

  const allPhotos = data.photosByDay.flatMap((d) => d.photos);
  const embedded = await embedPhotos(allPhotos);

  const reportDate = fmtShortDate(data.to);
  const titleDate = fmtTitleDate(data.to);
  const weekLabel = fmtRange(data.from, data.to);
  const subtitle = data.client
    ? `${data.projectName} · ${data.client}`
    : data.projectName;

  const fieldBullets = data.logs.length
    ? data.logs.map((log) => fieldStatusBullet(log, locale)).join('')
    : '<li class="dim">No daily logs in this date range.</li>';

  const photoIntro = data.photoIntro?.trim() || autoPhotoIntro();
  const photoRows: string[] = [];
  for (let i = 0; i < embedded.length; i += 2) {
    const pair = embedded.slice(i, i + 2);
    photoRows.push(`<div class="photo-row">${pair.map((p) => photoCell(p, locale)).join('')}</div>`);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: Letter; margin: 0.7in 0.8in 0.85in 0.8in; }
  body {
    font-family: 'Libre Baskerville', Georgia, 'Times New Roman', serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc { max-width: 7in; margin: 0 auto; }
  .doc-title {
    font-family: Inter, sans-serif;
    font-size: 13pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .doc-subtitle {
    font-size: 11pt;
    font-weight: 700;
    margin-bottom: 18px;
    color: #222;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
    margin-bottom: 22px;
    font-family: Inter, sans-serif;
    font-size: 9pt;
  }
  .meta-cell label {
    display: block;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #666;
    margin-bottom: 2px;
  }
  .meta-cell span { font-weight: 600; color: #111; }
  .section { margin-bottom: 20px; page-break-inside: avoid; }
  .section.break-before { page-break-before: always; }
  .sec-hdr {
    font-family: Inter, sans-serif;
    font-size: 10pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 8px;
    color: #0F1B33;
    border-bottom: 2px solid #C9A96E;
    padding-bottom: 4px;
  }
  .sec-body { font-size: 10.5pt; line-height: 1.5; color: #222; }
  .sec-body p { margin-bottom: 8px; }
  .field-list { margin: 0 0 8px 18px; padding: 0; }
  .field-list li { margin-bottom: 8px; }
  .field-list .dim { color: #888; font-style: italic; list-style: none; margin-left: -18px; }
  .photo-intro { font-size: 10pt; color: #444; margin-bottom: 14px; font-style: italic; }
  .photo-row { display: flex; gap: 16px; margin-bottom: 18px; page-break-inside: avoid; }
  .photo-cell { flex: 1; min-width: 0; }
  .photo-img { width: 100%; height: 2.35in; object-fit: cover; display: block; border: 1px solid #ddd; }
  .photo-missing {
    width: 100%; height: 2.35in; background: #f0f0f0; border: 1px solid #ddd;
    display: flex; align-items: center; justify-content: center;
    font-family: Inter, sans-serif; font-size: 9pt; color: #999;
  }
  .photo-cap {
    margin-top: 6px;
    font-size: 9.5pt;
    line-height: 1.4;
    text-align: center;
    color: #333;
  }
  .milestone-block { margin-bottom: 12px; }
  .milestone-title { font-weight: 700; margin-bottom: 4px; }
  .milestone-list { margin-left: 18px; }
  .milestone-list li { margin-bottom: 4px; }
  .table-note { font-size: 9.5pt; color: #555; margin-bottom: 10px; font-style: italic; }
  .ritz-tbl {
    width: 100%;
    border-collapse: collapse;
    font-family: Inter, sans-serif;
    font-size: 8.5pt;
    margin-top: 6px;
  }
  .ritz-tbl th {
    text-align: left;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.4px;
    padding: 6px 8px;
    border: 1px solid #ccc;
    background: #f5f5f5;
  }
  .ritz-tbl td {
    padding: 6px 8px;
    border: 1px solid #ddd;
    vertical-align: top;
    line-height: 1.4;
  }
  .ritz-tbl td.num { width: 28px; text-align: center; font-weight: 700; }
  .dim { color: #888; font-style: italic; }
  .ftr {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #ccc;
    font-family: Inter, sans-serif;
    font-size: 7.5pt;
    color: #888;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
</style>
</head>
<body>
<div class="doc">
  <div class="doc-title">${esc(pdf('docTitle'))} &nbsp; ${esc(titleDate)}</div>
  <div class="doc-subtitle">${esc(subtitle)}</div>

  <div class="meta-grid">
    <div class="meta-cell"><label>${esc(pdf('location'))}</label><span>${esc(data.location || '—')}</span></div>
    <div class="meta-cell"><label>${esc(pdf('reportDate'))}</label><span>${esc(reportDate)}</span></div>
    <div class="meta-cell"><label>${esc(pdf('preparedBy'))}</label><span>${esc(data.preparedBy)} — ${esc(GC_NAME_UPPER)}</span></div>
    <div class="meta-cell"><label>${esc(pdf('tcoTarget'))}</label><span>${esc(data.tcoTarget || pdf('tcoDefault'))}</span></div>
  </div>

  <div class="section">
    <div class="sec-hdr">${esc(pdf('overview'))}</div>
    <div class="sec-body"><p>${esc(data.overview)}</p></div>
  </div>

  <div class="section">
    <div class="sec-hdr">${esc(pdf('fieldStatus', { week: weekLabel }))}</div>
    <div class="sec-body">
      <ul class="field-list">${fieldBullets}</ul>
    </div>
  </div>

  <div class="section${allPhotos.length ? ' break-before' : ''}">
    <div class="sec-hdr">${esc(pdf('photography', { week: weekLabel }))}</div>
    <div class="sec-body">
      <p class="photo-intro">${esc(photoIntro)}</p>
      ${allPhotos.length ? photoRows.join('') : `<p class="dim">${esc(pdf('noPhotos'))}</p>`}
    </div>
  </div>

  <div class="section break-before">
    <div class="sec-hdr">${esc(pdf('milestones'))}</div>
    <div class="sec-body">${milestonesHtml(data.milestones)}</div>
  </div>

  <div class="section">
    <div class="sec-hdr">${esc(pdf('openItems'))}</div>
    <div class="sec-body">${openItemsTable(data.openItems)}</div>
  </div>

  <div class="section">
    <div class="sec-hdr">${esc(pdf('actionItems'))}</div>
    <div class="sec-body">${actionItemsTable(data.actionItems)}</div>
  </div>

  <div class="ftr">
    <span>${GC_NAME_UPPER} · ${GC_ADDRESS_FULL}</span>
    <span>${esc(pdf('confidential', { number: data.projectNumber }))}</span>
  </div>
</div>
</body></html>`;
}
