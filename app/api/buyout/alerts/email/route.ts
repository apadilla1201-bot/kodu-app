export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { buildAlerts } from '@/lib/buyout';
import { resolveEmailAddress, sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json().catch(() => ({}));
    const projectId = body?.projectId as string | undefined;
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const items = await prisma.buyoutItem.findMany({ where: { projectId } });
    const alerts = buildAlerts(items);
    if (alerts.length === 0) {
      return NextResponse.json({ ok: true, sent: false, message: 'No alerts to send' });
    }

    const to = resolveEmailAddress(body?.to, session.user?.email);
    if (!to) {
      return NextResponse.json({ error: 'No recipient email' }, { status: 400 });
    }

    const high = alerts.filter((a) => a.severity === 'high');
    const rows = alerts
      .slice(0, 40)
      .map(
        (a) =>
          `<tr><td style="padding:6px;border-bottom:1px solid #eee;font-size:12px;">${a.severity.toUpperCase()}</td><td style="padding:6px;border-bottom:1px solid #eee;font-size:12px;">${a.trade}</td><td style="padding:6px;border-bottom:1px solid #eee;font-size:12px;">${a.message}</td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:#0F1B33;padding:16px 20px;border-radius:8px 8px 0 0;">
          <h2 style="color:#C9A96E;margin:0;">Buyout Alerts — ${project.projectNumber}</h2>
        </div>
        <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
          <p><strong>${project.projectName}</strong></p>
          <p>${alerts.length} alert(s), ${high.length} high priority.</p>
          <table style="width:100%;border-collapse:collapse;background:#fff;">
            <thead><tr style="background:#0F1B33;color:#fff;text-align:left;">
              <th style="padding:8px;font-size:11px;">Severity</th>
              <th style="padding:8px;font-size:11px;">Trade</th>
              <th style="padding:8px;font-size:11px;">Issue</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    const result = await sendEmail({
      to,
      subject: `Buyout Alerts — ${project.projectNumber} (${high.length} high / ${alerts.length} total)`,
      html,
    });

    return NextResponse.json({ ok: result.ok, sent: result.ok, skipped: result.skipped, alerts: alerts.length });
  } catch (error: any) {
    console.error('POST /api/buyout/alerts/email error:', error);
    return NextResponse.json({ error: 'Failed to send alerts' }, { status: 500 });
  }
}
