export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// Campana de notificaciones — "items que requieren atención".
// DERIVADO en vivo (sin tabla nueva ni migración de BD):
//   1. RFIs vencidos (Open / Under Review con dateDue pasada)
//   2. CORs pendientes de aprobación (status = Pending)
//   3. Submittals esperando revisión (Submitted / Under Review)
// Todo con scope multi-tenant (companyId de la sesión).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date();
    const TAKE = 5; // máx por categoría
    const projectScope = { project: { companyId } };
    const projectSelect = { select: { projectNumber: true, projectName: true } };

    const [overdueRfis, pendingCors, reviewSubmittals] = await Promise.all([
      prisma.rFI.findMany({
        where: {
          ...projectScope,
          status: { in: ['Open', 'Under Review'] },
          dateDue: { lt: now },
        },
        select: {
          id: true, rfiNumber: true, subject: true, dateDue: true,
          project: projectSelect,
        },
        orderBy: { dateDue: 'asc' },
        take: TAKE,
      }),
      prisma.changeOrder.findMany({
        where: { ...projectScope, status: 'Pending' },
        select: {
          id: true, corNumber: true, description: true, totalAmount: true, date: true,
          project: projectSelect,
        },
        orderBy: { date: 'desc' },
        take: TAKE,
      }),
      prisma.submittal.findMany({
        where: { ...projectScope, status: { in: ['Submitted', 'Under Review'] } },
        select: {
          id: true, submittalNumber: true, title: true, status: true, requiredDate: true,
          project: projectSelect,
        },
        orderBy: { updatedAt: 'desc' },
        take: TAKE,
      }),
    ]);

    const items = [
      ...overdueRfis.map((r) => ({
        id: `rfi-${r.id}`,
        kind: 'rfi_overdue' as const,
        ref: r.rfiNumber,
        title: r.subject,
        project: r.project ? `${r.project.projectNumber} — ${r.project.projectName}` : '',
        detail: r.dateDue ? r.dateDue.toISOString() : null,
        href: `/dashboard/rfis/${r.id}`,
      })),
      ...pendingCors.map((c) => ({
        id: `cor-${c.id}`,
        kind: 'cor_pending' as const,
        ref: c.corNumber,
        title: c.description,
        project: c.project ? `${c.project.projectNumber} — ${c.project.projectName}` : '',
        detail: `$${(c.totalAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        href: `/dashboard/cors/${c.id}`,
      })),
      ...reviewSubmittals.map((s) => ({
        id: `sub-${s.id}`,
        kind: 'submittal_review' as const,
        ref: s.submittalNumber,
        title: s.title,
        project: s.project ? `${s.project.projectNumber} — ${s.project.projectName}` : '',
        detail: s.status,
        href: `/dashboard/submittals/${s.id}`,
      })),
    ];

    return NextResponse.json({
      items,
      counts: {
        overdueRfis: overdueRfis.length,
        pendingCors: pendingCors.length,
        reviewSubmittals: reviewSubmittals.length,
        total: items.length,
      },
    });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}
