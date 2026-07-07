/**
 * Weekly / range Field Report PDF for owners — daily logs + site photos.
 */
import { downloadFileBuffer } from '@/lib/s3';
import { GC_ADDRESS_FULL, GC_NAME_UPPER } from '@/lib/gc-branding';
import { formatLogDate } from '@/lib/daily-log';
import { guessMimeType } from '@/lib/storage';
import { photoLocationLine, photoTagLabel } from '@/lib/site-photos';

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
  status: string;
  priority: string;
};

export type FieldReportData = {
  projectNumber: string;
  projectName: string;
  client: string | null;
  location: string | null;
  from: string;
  to: string;
  preparedBy: string;
  logs: FieldReportLog[];
  photosByDay: { date: string; label: string; photos: FieldReportPhoto[] }[];
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
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  if (from === to) return f.toLocaleDateString('en-US', opts);
  return `${f.toLocaleDateString('en-US', opts)} – ${t.toLocaleDateString('en-US', opts)}`;
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

function logBlock(log: FieldReportLog): string {
  const rows: string[] = [];
  const add = (label: string, val: string | null | undefined) => {
    if (!val?.trim()) return;
    rows.push(`<tr><td class="lbl">${esc(label)}</td><td>${esc(val.trim())}</td></tr>`);
  };
  add('Weather', log.weather ? `${log.weather}${log.temperature ? ` · ${log.temperature}` : ''}` : log.temperature);
  add('Work performed', log.workPerformed);
  add('Crew / manpower', log.crewNotes);
  add('Deliveries', log.deliveries);
  add('Delays / issues', log.delays);
  if (!rows.length) {
    rows.push('<tr><td colspan="2" class="dim">No field notes recorded for this day.</td></tr>');
  }
  return `
    <div class="day-block">
      <div class="day-hdr">
        <div class="day-title">${esc(formatLogDate(log.logDate))}</div>
        <div class="day-meta">${esc(log.authorName)} · ${esc(log.status)}</div>
      </div>
      <table class="log-tbl">${rows.join('')}</table>
    </div>`;
}

function photoCard(p: PhotoWithData): string {
  const loc = photoLocationLine(p);
  const meta = [photoTagLabel(p.tag), loc, p.caption?.trim()].filter(Boolean).join(' · ');
  const img = p.dataUrl
    ? `<img src="${p.dataUrl}" alt="" class="photo-img"/>`
    : `<div class="photo-missing">Image unavailable</div>`;
  return `
    <div class="photo-card">
      ${img}
      <div class="photo-cap">${esc(meta || 'Site photo')}</div>
    </div>`;
}

function photosPage(title: string, photos: PhotoWithData[], pageNum: number, totalPages: number, data: FieldReportData): string {
  const grid = photos.map(photoCard).join('');
  return `
  <div class="page">
    <div class="sub-hdr">
      <div class="sub-hdr-title">${esc(title)}</div>
      <div class="sub-hdr-proj">#${esc(data.projectNumber)} ${esc(data.projectName)}</div>
    </div>
    <div class="gold-line"></div>
    <div class="body">
      <div class="photo-grid">${grid}</div>
    </div>
    ${footer(pageNum, totalPages, data)}
  </div>`;
}

function footer(pageNum: number, totalPages: number, data: FieldReportData): string {
  return `
    <div class="ftr">
      <div>${GC_NAME_UPPER} | ${GC_ADDRESS_FULL}</div>
      <div>Page ${pageNum} of ${totalPages}</div>
      <div>CONFIDENTIAL — FIELD REPORT</div>
    </div>`;
}

export async function buildFieldReportHtml(data: FieldReportData): Promise<string> {
  const totalPhotos = data.photosByDay.reduce((n, d) => n + d.photos.length, 0);
  const daysWithLogs = data.logs.length;
  const issuePhotos = data.photosByDay.flatMap((d) => d.photos).filter((p) => p.tag === 'issue' || p.tag === 'safety').length;

  // Embed all photos
  const embeddedByDay: { date: string; label: string; photos: PhotoWithData[] }[] = [];
  for (const day of data.photosByDay) {
    embeddedByDay.push({
      ...day,
      photos: await embedPhotos(day.photos),
    });
  }

  const photoPages: { title: string; photos: PhotoWithData[] }[] = [];
  for (const day of embeddedByDay) {
    if (!day.photos.length) continue;
    for (let i = 0; i < day.photos.length; i += 4) {
      photoPages.push({
        title: i === 0 ? `Site Photos — ${day.label}` : `${day.label} (continued)`,
        photos: day.photos.slice(i, i + 4),
      });
    }
  }

  const hasRfi = data.openRfis.length > 0;
  const totalPages = 1 + (daysWithLogs > 0 ? 1 : 0) + photoPages.length + (hasRfi ? 1 : 0);
  let pageNum = 1;

  const cover = `
  <div class="page">
    <div class="hdr">
      <div class="hdr-left">
        <div class="hdr-eyebrow">WEEKLY FIELD REPORT <span>|</span> ${esc(fmtRange(data.from, data.to))} <span>|</span> CONFIDENTIAL</div>
        <div class="hdr-project">${esc(data.projectName.toUpperCase())}</div>
      </div>
      <div class="hdr-right">
        ${esc(data.client || 'Owner')} | Project #${esc(data.projectNumber)}${data.location ? ` | ${esc(data.location)}` : ''}
      </div>
    </div>
    <div class="gold-line"></div>
    <div class="body">
      <div class="sec-title-wrap">
        <div class="sec-title-bar"></div>
        <div>
          <div class="sec-title">Jobsite Progress Summary</div>
          <div class="sec-subtitle">DAILY LOGS & SITE PHOTOGRAPHY | ${esc(fmtRange(data.from, data.to))}</div>
        </div>
      </div>
      <div class="sec-desc">
        Executive field report prepared by ${esc(data.preparedBy)} for the project owner.
        Includes superintendent daily logs, identified site photos (location, trade, description), and open RFIs.
      </div>
      <div class="kpi-row">
        <div class="kpi-card gold"><div class="kpi-val">${daysWithLogs}</div><div class="kpi-label">Daily logs</div></div>
        <div class="kpi-card blue"><div class="kpi-val">${totalPhotos}</div><div class="kpi-label">Site photos</div></div>
        <div class="kpi-card amber"><div class="kpi-val">${issuePhotos}</div><div class="kpi-label">Issue / safety photos</div></div>
        <div class="kpi-card green"><div class="kpi-val">${data.openRfis.length}</div><div class="kpi-label">Open RFIs</div></div>
      </div>
      ${data.logs.some((l) => l.delays?.trim()) ? `
      <div class="driver-box">
        <div class="driver-title">Field delays noted this period</div>
        <div class="driver-text">${data.logs.filter((l) => l.delays?.trim()).map((l) => `<strong>${esc(formatLogDate(l.logDate))}:</strong> ${esc(l.delays!.trim())}`).join('<br/>')}</div>
      </div>` : ''}
      <div class="slabel">Report contents</div>
      <ul class="toc">
        ${daysWithLogs ? '<li>Daily superintendent logs</li>' : ''}
        ${totalPhotos ? `<li>${totalPhotos} site photo(s) with location &amp; trade identification</li>` : ''}
        ${hasRfi ? '<li>Open RFIs requiring owner / design response</li>' : ''}
        ${!daysWithLogs && !totalPhotos ? '<li class="dim">No field data in this date range — expand dates or add daily logs / photos.</li>' : ''}
      </ul>
    </div>
    ${footer(pageNum++, totalPages, data)}
  </div>`;

  let logsPage = '';
  if (daysWithLogs > 0) {
    logsPage = `
    <div class="page">
      <div class="sub-hdr">
        <div class="sub-hdr-title">Daily Superintendent Logs</div>
        <div class="sub-hdr-proj">${esc(fmtRange(data.from, data.to))}</div>
      </div>
      <div class="gold-line"></div>
      <div class="body">
        ${data.logs.map(logBlock).join('')}
      </div>
      ${footer(pageNum++, totalPages, data)}
    </div>`;
  }

  const photoPagesHtml = photoPages.map((pp) => photosPage(pp.title, pp.photos, pageNum++, totalPages, data)).join('');

  let rfiPage = '';
  if (hasRfi) {
    rfiPage = `
    <div class="page">
      <div class="sub-hdr">
        <div class="sub-hdr-title">Open RFIs</div>
        <div class="sub-hdr-proj">Ball in court — design / owner</div>
      </div>
      <div class="gold-line"></div>
      <div class="body">
        <table class="ft">
          <thead><tr><th>RFI #</th><th>Subject</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>
            ${data.openRfis.map((r) => `
              <tr>
                <td><strong>${esc(r.rfiNumber)}</strong></td>
                <td>${esc(r.subject)}</td>
                <td>${esc(r.priority)}</td>
                <td>${esc(r.status)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${footer(pageNum++, totalPages, data)}
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; color: #1a1a1a; background: #F5F3EF; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 8.5in; height: 11in; position: relative; overflow: hidden; page-break-after: always; background: #F5F3EF; }
  .page:last-child { page-break-after: auto; }
  .hdr { background: #0F1B33; padding: 16px 40px 14px; display: flex; justify-content: space-between; align-items: flex-start; }
  .hdr-eyebrow { font-size: 8px; letter-spacing: 2.5px; text-transform: uppercase; color: #C9A96E; font-weight: 600; }
  .hdr-eyebrow span { color: rgba(255,255,255,0.35); }
  .hdr-project { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 800; color: #C9A96E; margin-top: 4px; }
  .hdr-right { text-align: right; color: rgba(255,255,255,0.5); font-size: 8px; line-height: 1.5; max-width: 220px; }
  .sub-hdr { background: #0F1B33; padding: 10px 40px; display: flex; justify-content: space-between; align-items: center; }
  .sub-hdr-title { font-family: 'Playfair Display', serif; font-size: 14px; font-weight: 700; color: #fff; }
  .sub-hdr-proj { font-size: 8px; color: rgba(255,255,255,0.55); }
  .gold-line { height: 3px; background: linear-gradient(90deg, #C9A96E, rgba(201,169,110,0.2)); }
  .body { padding: 18px 40px 50px; }
  .sec-title-wrap { display: flex; align-items: stretch; margin-bottom: 8px; }
  .sec-title-bar { width: 4px; background: #C9A96E; border-radius: 2px; margin-right: 14px; }
  .sec-title { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 800; color: #0F1B33; line-height: 1.15; }
  .sec-subtitle { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #999; font-weight: 600; margin-top: 4px; }
  .sec-desc { font-size: 10px; color: #666; line-height: 1.55; margin-bottom: 16px; max-width: 100%; }
  .kpi-row { display: flex; gap: 10px; margin-bottom: 16px; }
  .kpi-card { flex: 1; background: #fff; border: 1px solid #e8e5e0; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-card.gold { border-top: 3px solid #C9A96E; }
  .kpi-card.blue { border-top: 3px solid #3B82F6; }
  .kpi-card.amber { border-top: 3px solid #D97706; }
  .kpi-card.green { border-top: 3px solid #10B981; }
  .kpi-val { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 800; color: #0F1B33; }
  .kpi-label { font-size: 7px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-top: 4px; font-weight: 700; }
  .driver-box { background: #fff; border: 1px solid #e8e5e0; border-left: 4px solid #C9A96E; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; }
  .driver-title { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0F1B33; margin-bottom: 6px; }
  .driver-text { font-size: 9.5px; line-height: 1.6; color: #333; }
  .slabel { font-size: 8px; text-transform: uppercase; letter-spacing: 2px; color: #999; font-weight: 700; margin-bottom: 8px; }
  .toc { font-size: 10px; color: #333; line-height: 1.8; padding-left: 18px; }
  .toc .dim { color: #999; }
  .day-block { background: #fff; border: 1px solid #e8e5e0; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
  .day-hdr { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
  .day-title { font-family: 'Playfair Display', serif; font-size: 14px; font-weight: 700; color: #0F1B33; }
  .day-meta { font-size: 8px; color: #888; margin-top: 2px; }
  .log-tbl { width: 100%; border-collapse: collapse; }
  .log-tbl td { padding: 4px 0; font-size: 9.5px; vertical-align: top; line-height: 1.5; }
  .log-tbl td.lbl { width: 110px; font-weight: 700; color: #666; text-transform: uppercase; font-size: 7.5px; letter-spacing: 0.5px; }
  .log-tbl td.dim { color: #999; font-style: italic; }
  .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .photo-card { background: #fff; border: 1px solid #e8e5e0; border-radius: 6px; overflow: hidden; }
  .photo-img { width: 100%; height: 2.4in; object-fit: cover; display: block; }
  .photo-missing { height: 2.4in; background: #eee; display: flex; align-items: center; justify-content: center; color: #999; font-size: 9px; }
  .photo-cap { padding: 8px 10px; font-size: 8.5px; line-height: 1.45; color: #333; border-top: 1px solid #eee; }
  .ft { width: 100%; border-collapse: collapse; }
  .ft th { font-size: 7.5px; text-transform: uppercase; letter-spacing: 1px; text-align: left; padding: 6px 8px; border-bottom: 2px solid #0F1B33; color: #C9A96E; }
  .ft td { padding: 6px 8px; font-size: 9.5px; border-bottom: 1px solid #e8e5e0; }
  .ftr { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 40px; font-size: 7px; color: #aaa; border-top: 1px solid #ddd; display: flex; justify-content: space-between; }
</style>
</head>
<body>
${cover}
${logsPage}
${photoPagesHtml}
${rfiPage}
</body></html>`;
}
