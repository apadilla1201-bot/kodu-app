export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// Approval Inbox — bandeja de aprobaciones cruzando TODOS los proyectos
// de la compañía. Derivado en vivo (sin tabla nueva ni migración):
//   1. CORs pendientes de aprobación (status = Pending) + monto total
//   2. Submittals esperando revisión (Submitted / Under Review)
//   3. RFIs vencidos (Open / Under Review con dateDue pasada)
// Scope multi-tenant (companyId). Conteos verdaderos (count) + hasta 50 por grupo.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date();
    const TAKE = 50;
    const projectScope = { project: { companyId } };
    const projectSelect = { select: { id: true, projectNumber: true, projectName: true } };

    const corWhere = { ...projectScope, status: 'Pending' };
    const rfiWhere = {
      ...projectScope,
      status: { in: ['Open', 'Under Review'] },
      dateDue: { lt: now },
    };
    const subWhere = { ...projectScope, status: { in: ['Submitted', 'Under Review'] } };

    const [pendingCors, overdueRfis, reviewSubmittals, corTotal, corCount, rfiCount, subCount] =
      await Promise.all([
        prisma.changeOrder.findMany({
          where: corWhere,
          select: {
            id: true, corNumber: true, description: true, subcontractor: true,
            totalAmount: true, date: true,
            project: projectSelect,
          },
          orderBy: { date: 'asc' }, // los más viejos primero (llevan más tiempo esperando)
          take: TAKE,
        }),
        prisma.rFI.findMany({
          where: rfiWhere,
          select: {
            id: true, rfiNumber: true, subject: true, priority: true,
            dateDue: true, ballInCourt: true,
            project: projectSelect,
          },
          orderBy: { dateDue: 'asc' },
          take: TAKE,
        }),
        prisma.submittal.findMany({
          where: subWhere,
          select: {
            id: true, submittalNumber: true, title: true, status: true,
            specSection: true, requiredDate: true, ballInCourt: true,
            project: projectSelect,
          },
          orderBy: { requiredDate: 'asc' },
          take: TAKE,
        }),
        prisma.changeOrder.aggregate({
          where: corWhere,
          _sum: { totalAmount: true },
        }),
        prisma.changeOrder.count({ where: corWhere }),
        prisma.rFI.count({ where: rfiWhere }),
        prisma.submittal.count({ where: subWhere }),
      ]);

    return NextResponse.json({
      cors: pendingCors.map((c) => ({
        id: c.id,
        ref: c.corNumber,
        title: c.description,
        subtitle: c.subcontractor ?? '',
        amount: c.totalAmount ?? 0,
        date: c.date ? c.date.toISOString() : null,
        projectId: c.project?.id ?? '',
        project: c.project ? `${c.project.projectNumber} — ${c.project.projectName}` : '',
        href: `/dashboard/cors/${c.id}`,
      })),
      rfis: overdueRfis.map((r) => ({
        id: r.id,
        ref: r.rfiNumber,
        title: r.subject,
        subtitle: r.ballInCourt ? `Ball in court: ${r.ballInCourt}` : '',
        priority: r.priority,
        date: r.dateDue ? r.dateDue.toISOString() : null,
        projectId: r.project?.id ?? '',
        project: r.project ? `${r.project.projectNumber} — ${r.project.projectName}` : '',
        href: `/dashboard/rfis/${r.id}`,
      })),
      submittals: reviewSubmittals.map((s) => ({
        id: s.id,
        ref: s.submittalNumber,
        title: s.title,
        subtitle: [s.specSection, s.status].filter(Boolean).join(' · '),
        date: s.requiredDate ? s.requiredDate.toISOString() : null,
        projectId: s.project?.id ?? '',
        project: s.project ? `${s.project.projectNumber} — ${s.project.projectName}` : '',
        href: `/dashboard/submittals/${s.id}`,
      })),
      counts: {
        cors: corCount,
        rfis: rfiCount,
        submittals: subCount,
        total: corCount + rfiCount + subCount,
      },
      pendingCorAmount: corTotal._sum.totalAmount ?? 0,
    });
  } catch (error) {
    console.error('GET /api/approvals error:', error);
    return NextResponse.json({ error: 'Failed to load approvals' }, { status: 500 });
  }
}
