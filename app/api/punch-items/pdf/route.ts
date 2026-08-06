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
  Open: '#b45309',
  'In Progress': '#1d4ed8',
  'Ready for Review': '#7e22ce',
  Completed: '#15803d',
  Disputed: '#b91c1c',
};

const PRIO_LABELS: Record<string, string> = {
  A: 'A — Life Safety / TCO',
  B: 'B — Functional',
  C: 'C — Cosmetic',
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
      select: { projectNumber: true, projectName: true, client: true, location: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const items = await prisma.punchItem.findMany({
      where: { projectId },
      orderBy: { itemNumber: 'asc' },
    });

    const brand = await getPdfBrand(companyId, appBaseUrl(), 38);
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const open = items.filter((i) => i.status !== 'Completed').length;

    // Agrupado por área (estilo Excel PDG Arena Madness)
    const areaOrder = [...new Set(items.map((it) => it.area).filter(Boolean))].sort() as string[];
    const noArea = items.filter((it) => !it.area);
    const groups: { name: string; rows: typeof items }[] = [
      ...areaOrder.map((a) => ({ name: a, rows: items.filter((it) => it.area === a) })),
      ...(noArea.length ? [{ name: 'General / No area', rows: noArea }] : []),
    ];

    const renderRow = (it: (typeof items)[number]) => {
      const color = STATUS_COLORS[it.status] ?? '#333';
      const due = it.dueDate ? new Date(it.dueDate).toLocaleDateString('en-US') : '—';
      const completed = it.completedAt ? new Date(it.completedAt).toLocaleDateString('en-US') : '—';
      return `<tr>
        <td style="text-align:center;font-weight:bold;">PL-${String(it.itemNumber).padStart(3, '0')}</td>
        <td><b>${esc(it.title)}</b>${it.correctiveAction ? `<br/><span style="color:#0F1B33;font-size:8.5pt;"><b>Action:</b> ${esc(it.correctiveAction)}</span>` : ''}${it.backCharge ? `<br/><span style="color:#b91c1c;font-size:8.5pt;font-weight:bold;">BACK-CHARGE: $${Number(it.backCharge).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>` : ''}</td>
        <td>${esc(it.location) || '—'}</td>
        <td>${esc(it.trade) || '—'}</td>
        <td>${esc(it.assignedToName) || '—'}</td>
        <td style="text-align:center;" title="${PRIO_LABELS[it.priority] ?? it.priority}"><b>${it.priority}</b></td>
        <td style="text-align:center;">${due}</td>
        <td style="text-align:center;"><span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:8pt;font-weight:bold;white-space:nowrap;">${it.status}</span></td>
        <td style="text-align:center;">${completed}</td>
      </tr>`;
    };

    const rows = groups.map((g) => {
      const closedInArea = g.rows.filter((r) => r.status === 'Completed').length;
      return `<tr><td colspan="9" style="background:#f2f0ea;font-weight:bold;color:#0F1B33;padding:7px 8px;border-bottom:1px solid #bbb;">${esc(g.name)} <span style="font-weight:normal;color:#666;">(${closedInArea}/${g.rows.length} closed)</span></td></tr>`
        + g.rows.map(renderRow).join('');
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
  .sig td { width: 33%; padding: 0 14px; font-size: 9pt; }
  .sig .line { border-top: 1.5px solid #1a1a1a; padding-top: 5px; margin-top: 40px; }
  .foot { font-size: 7.5pt; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; }
</style></head><body>
  <div class="brand">
    <div>${brand.logoHtml}</div>
    <div class="brand-info">
      <b>${esc(brand.name)}</b>${brand.license ? `<br/>License: ${esc(brand.license)}` : ''}${brand.addressHtml ? `<br/>${brand.addressHtml}` : ''}${brand.phone ? `<br/>${esc(brand.phone)}` : ''}
    </div>
  </div>

  <h1>PUNCH LIST REPORT</h1>
  <p class="meta">
    Project: <b>${esc(project.projectNumber)} — ${esc(project.projectName)}</b>${project.location ? ` · ${esc(project.location)}` : ''}<br/>
    Owner: ${esc(project.client)} · Report date: ${today}
  </p>

  <div class="summary">
    <div class="card"><b>${items.length}</b>Total items</div>
    <div class="card"><b>${open}</b>Open items</div>
    <div class="card"><b>${items.length - open}</b>Completed (${items.length ? Math.round(((items.length - open) / items.length) * 100) : 0}%)</div>
    <div class="card"><b>${items.filter((i) => i.status === 'Ready for Review').length}</b>Ready for review</div>
    <div class="card"><b>${items.filter((i) => i.status === 'Disputed').length}</b>Disputed</div>
    <div class="card"><b>${items.filter((i) => i.priority === 'A' && i.status !== 'Completed').length}</b>Priority A open (blocks TCO)</div>
  </div>
  <p style="font-size:8pt;color:#777;margin:-8px 0 12px;">Priority: A = Life Safety / TCO (blocks turnover) · B = Functional · C = Cosmetic. Two-step closeout: subcontractor marks Ready for Review; only the GC verifies and closes.</p>

  <table class="items">
    <thead><tr>
      <th style="width:34px;">#</th><th>Item</th><th>Location</th><th>Trade</th>
      <th>Responsible</th><th style="width:52px;">Priority</th><th style="width:70px;">Due</th>
      <th style="width:96px;">Status</th><th style="width:70px;">Completed</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#777;padding:18px;">No punch items for this project.</td></tr>'}</tbody>
  </table>

  <table class="sig"><tr>
    <td><div class="line">General Contractor — Signature / Date</div></td>
    <td><div class="line">Owner / Owner's Rep — Signature / Date</div></td>
    <td><div class="line">Architect — Signature / Date</div></td>
  </tr></table>

  <div class="foot">Generated by ${esc(brand.name)} via koduPM on ${today}</div>
</body></html>`;

    const pdf = await htmlToPdf(html, { format: 'Letter', landscape: true });
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PunchList_${project.projectNumber}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/punch-items/pdf error:', error);
    return NextResponse.json({ error: 'Failed to generate punch list PDF' }, { status: 500 });
  }
}
