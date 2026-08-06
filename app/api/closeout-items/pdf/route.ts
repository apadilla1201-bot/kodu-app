export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { isFullAccess } from '@/lib/permissions';
import { getPdfBrand } from '@/lib/company-brand';
import { appBaseUrl } from '@/lib/app-url';
import { htmlToPdf } from '@/lib/pdf';

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STATUS_COLORS: Record<string, string> = {
  Pending: '#b45309',
  Requested: '#1d4ed8',
  Received: '#7e22ce',
  Verified: '#15803d',
};

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role ?? 'viewer';
    const companyId = (session.user as any)?.companyId ?? '';
    if (!isFullAccess(role) && role !== 'superintendent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { projectNumber: true, projectName: true, client: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const items = await prisma.closeoutItem.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const brand = await getPdfBrand(companyId, appBaseUrl(), 38);
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const verified = items.filter((i) => i.status === 'Verified').length;
    const received = items.filter((i) => i.status === 'Received').length;
    const pct = items.length ? Math.round(((verified) / items.length) * 100) : 0;

    const catOrder = [...new Set(items.map((i) => i.category))];
    const rows = catOrder.map((cat) => {
      const inCat = items.filter((i) => i.category === cat);
      const doneCat = inCat.filter((i) => i.status === 'Verified' || i.status === 'Received').length;
      const body = inCat.map((it) => {
        const color = STATUS_COLORS[it.status] ?? '#333';
        const rec = it.dateReceived ? new Date(it.dateReceived).toLocaleDateString('en-US') : '—';
        return `<tr>
          <td><b>${esc(it.deliverable)}</b>${it.notes ? `<br/><span style="color:#555;font-size:8.5pt;">${esc(it.notes)}</span>` : ''}</td>
          <td>${esc(it.responsible) || '—'}</td>
          <td style="text-align:center;"><span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:8pt;font-weight:bold;white-space:nowrap;">${it.status}</span></td>
          <td style="text-align:center;">${rec}</td>
          <td style="text-align:center;">${it.fileUrl ? '✓' : '—'}</td>
        </tr>`;
      }).join('');
      return `<tr><td colspan="5" style="background:#f2f0ea;font-weight:bold;color:#0F1B33;padding:7px 8px;border-bottom:1px solid #bbb;">${esc(cat)} <span style="font-weight:normal;color:#666;">(${doneCat}/${inCat.length})</span></td></tr>` + body;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; color: #1a1a1a; font-size: 9.5pt; margin: 0; }
  .brand { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0F1B33; padding-bottom: 12px; margin-bottom: 18px; }
  .brand-info { font-size: 8.5pt; color: #444; text-align: right; line-height: 1.5; }
  h1 { font-size: 15pt; margin: 0 0 2px; color: #0F1B33; }
  .meta { font-size: 9pt; color: #555; margin-bottom: 14px; }
  .summary { display: flex; gap: 10px; margin-bottom: 16px; }
  .card { border: 1px solid #ddd; border-radius: 6px; padding: 8px 14px; font-size: 8.5pt; color: #555; }
  .card b { display: block; font-size: 14pt; color: #0F1B33; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { background: #0F1B33; color: #fff; padding: 6px 8px; font-size: 8.5pt; text-align: left; }
  table.items td { border-bottom: 1px solid #ddd; padding: 6px 8px; vertical-align: top; font-size: 9pt; }
  .sig { margin-top: 40px; width: 100%; }
  .sig td { width: 50%; padding: 0 14px; font-size: 9pt; }
  .sig .line { border-top: 1.5px solid #1a1a1a; padding-top: 5px; margin-top: 40px; }
  .foot { font-size: 7.5pt; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; }
</style></head><body>
  <div class="brand">
    <div>${brand.logoHtml}</div>
    <div class="brand-info">
      <b>${esc(brand.name)}</b>${brand.license ? `<br/>License: ${esc(brand.license)}` : ''}${brand.addressHtml ? `<br/>${brand.addressHtml}` : ''}${brand.phone ? `<br/>${esc(brand.phone)}` : ''}
    </div>
  </div>

  <h1>PROJECT CLOSEOUT DOCUMENTATION TRACKER</h1>
  <p class="meta">
    Project: <b>${esc(project.projectNumber)} — ${esc(project.projectName)}</b><br/>
    Owner: ${esc(project.client)} · Report date: ${today}
  </p>

  <div class="summary">
    <div class="card"><b>${items.length}</b>Total deliverables</div>
    <div class="card"><b>${verified}</b>Verified (${pct}%)</div>
    <div class="card"><b>${received}</b>Received (pending verify)</div>
    <div class="card"><b>${items.length - verified - received}</b>Outstanding</div>
  </div>

  <table class="items">
    <thead><tr>
      <th>Deliverable</th><th style="width:150px;">Responsible</th>
      <th style="width:90px;">Status</th><th style="width:80px;">Received</th><th style="width:44px;">Doc</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#777;padding:18px;">No closeout items for this project.</td></tr>'}</tbody>
  </table>

  <table class="sig"><tr>
    <td><div class="line">General Contractor — Signature / Date</div></td>
    <td><div class="line">Owner / Owner's Rep — Signature / Date</div></td>
  </tr></table>

  <div class="foot">Generated by ${esc(brand.name)} via koduPM on ${today}</div>
</body></html>`;

    const pdf = await htmlToPdf(html, { format: 'Letter' });
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Closeout_${project.projectNumber}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/closeout-items/pdf error:', error);
    return NextResponse.json({ error: 'Failed to generate closeout PDF' }, { status: 500 });
  }
}
