export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import { appBaseUrl } from '@/lib/app-url';
import { getPdfBrand } from '@/lib/company-brand';
import { downloadFileBuffer } from '@/lib/s3';
import { formatLogDate } from '@/lib/daily-log';
import { getSessionLocale } from '@/lib/i18n/server';

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function photoToDataUrl(photo: {
  cloudStoragePath: string;
  fileType: string | null;
  fileName: string | null;
}): Promise<string | null> {
  try {
    const buffer = await downloadFileBuffer(photo.cloudStoragePath);
    const mime = photo.fileType || 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string; logId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';
    const brand = await getPdfBrand(companyId, appBaseUrl(), 34);

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const log = await prisma.dailyLog.findUnique({
      where: { id: params.logId },
      include: { photos: { orderBy: { takenAt: 'asc' } } },
    });
    if (!log || log.projectId !== params.id) {
      return NextResponse.json({ error: 'Daily log not found' }, { status: 404 });
    }

    const locale = await getSessionLocale();
    const dateLocale = locale === 'es' ? 'es-US' : 'en-US';
    const logDateLabel = new Date(log.logDate).toLocaleDateString(dateLocale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Embed photos
    const photoDataUrls = await Promise.all(
      log.photos.map((p) => photoToDataUrl(p)),
    );

    const photoRows: string[] = [];
    for (let i = 0; i < photoDataUrls.length; i += 2) {
      const pair = photoDataUrls.slice(i, i + 2);
      const cells = pair
        .map((dataUrl, idx) => {
          const photo = log.photos[i + idx];
          const caption = [photo.area, photo.caption]
            .filter(Boolean)
            .join(' — ') || 'Site photo';
          const img = dataUrl
            ? `<img src="${dataUrl}" alt="" class="photo-img"/>`
            : `<div class="photo-missing">Image unavailable</div>`;
          return `
            <div class="photo-cell">
              ${img}
              <div class="photo-cap">${esc(caption)}</div>
            </div>`;
        })
        .join('');
      photoRows.push(`<div class="photo-row">${cells}</div>`);
    }

    const sections: string[] = [];
    const addSection = (title: string, content: string | null) => {
      if (!content?.trim()) return;
      sections.push(`
        <div class="section">
          <div class="sec-hdr">${esc(title)}</div>
          <div class="sec-body"><p>${esc(content.trim())}</p></div>
        </div>`);
    };

    addSection('Work Performed', log.workPerformed);
    addSection('Crew Notes', log.crewNotes);
    addSection('Deliveries', log.deliveries);
    addSection('Delays / Issues', log.delays);

    const weatherLine = log.weather
      ? `Weather: ${log.weather}${log.temperature ? ` — ${log.temperature}` : ''}`
      : null;

    const html = `<!DOCTYPE html>
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
  .section { margin-bottom: 18px; page-break-inside: avoid; }
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
  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: Inter, sans-serif;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .status-draft { background: #f0f0f0; color: #555; }
  .status-submitted { background: #dbeafe; color: #1e40af; }
  .status-approved { background: #d1fae5; color: #065f46; }
</style>
</head>
<body>
<div class="doc">
  <div style="margin-bottom:10px;">${brand.logoHtml ?? ''}</div>
  <div class="doc-title">Daily Log Report</div>
  <div class="doc-subtitle">${esc(project.projectName)}${project.client ? ` · ${esc(project.client)}` : ''}</div>

  <div class="meta-grid">
    <div class="meta-cell"><label>Date</label><span>${esc(logDateLabel)}</span></div>
    <div class="meta-cell"><label>Author</label><span>${esc(log.authorName || '—')}</span></div>
    <div class="meta-cell"><label>Status</label><span><span class="status-badge status-${esc(log.status.toLowerCase())}">${esc(log.status)}</span></span></div>
    <div class="meta-cell"><label>Project #</label><span>${esc(project.projectNumber)}</span></div>
    ${weatherLine ? `<div class="meta-cell"><label>Conditions</label><span>${esc(weatherLine)}</span></div>` : ''}
    <div class="meta-cell"><label>Prepared By</label><span>${esc(session.user?.name || 'Project Team')} — ${esc(brand.nameUpper)}</span></div>
  </div>

  ${sections.join('')}

  ${log.photos.length ? `
  <div class="section${sections.length ? ' break-before' : ''}">
    <div class="sec-hdr">Site Photos (${log.photos.length})</div>
    <div class="sec-body">
      ${photoRows.join('')}
    </div>
  </div>` : ''}

  <div class="ftr">
    <span>${esc(brand.nameUpper)}${brand.addressFull ? ` · ${esc(brand.addressFull)}` : ''}</span>
    <span>CONFIDENTIAL · ${esc(project.projectNumber)}</span>
  </div>
</div>
</body></html>`;

    const pdfBytes = await htmlToPdf(html, {
      format: 'Letter',
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });

    const dateKey = new Date(log.logDate).toISOString().slice(0, 10);
    const fname = `DAILY_LOG_${project.projectNumber}_${dateKey}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fname}"`,
      },
    });
  } catch (error: any) {
    console.error('Daily log PDF error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate daily log PDF' },
      { status: 500 },
    );
  }
}
