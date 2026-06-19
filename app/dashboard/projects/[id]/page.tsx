export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import { ProjectDetailContent } from '@/components/project-detail-content';

export default async function ProjectDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const userId = (session.user as any)?.id ?? '';

  const project = await prisma.project.findFirst({
    where: { id: params?.id ?? '', userId },
    include: {
      changeOrders: {
        include: { lineItems: true },
        orderBy: { sequence: 'asc' },
      },
      rfis: {
        include: { attachments: true },
        orderBy: { createdAt: 'desc' },
      },
      payApplications: {
        include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { applicationNumber: 'desc' },
      },
      budgets: {
        include: { _count: { select: { lineItems: true, detailItems: true } } },
        orderBy: { budgetDate: 'desc' },
      },
      schedules: {
        include: {
          activities: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!project) notFound();

  const serialized = {
    id: project.id,
    projectNumber: project.projectNumber ?? '',
    projectName: project.projectName ?? '',
    client: project.client ?? '',
    location: project.location ?? '',
    contractAmount: project.contractAmount ?? 0,
    startDate: project.startDate ? new Date(project.startDate).toISOString() : null,
    changeOrders: (project.changeOrders ?? []).map((co: any) => ({
      id: co.id,
      corNumber: co.corNumber ?? '',
      sequence: co.sequence ?? 0,
      date: co.date ? new Date(co.date).toISOString() : '',
      approvalDate: co.approvalDate ? new Date(co.approvalDate).toISOString() : null,
      description: co.description ?? '',
      subcontractor: co.subcontractor ?? '',
      status: co.status ?? 'Pending',
      subtotal: co.subtotal ?? 0,
      overheadProfit: co.overheadProfit ?? 0,
      generalLiability: co.generalLiability ?? 0,
      salesTax: co.salesTax ?? 0,
      totalAmount: co.totalAmount ?? 0,
      csiCode: co.csiCode ?? '',
      notes: co.notes ?? '',
      lineItems: (co.lineItems ?? []).map((li: any) => ({
        id: li.id, description: li.description ?? '', quantity: li.quantity ?? 0,
        unit: li.unit ?? '', unitPrice: li.unitPrice ?? 0, total: li.total ?? 0,
      })),
    })),
    rfis: (project.rfis ?? []).map((rfi: any) => ({
      id: rfi.id,
      rfiNumber: rfi.rfiNumber ?? '',
      subject: rfi.subject ?? '',
      status: rfi.status ?? 'Open',
      priority: rfi.priority ?? 'Normal',
      submittedBy: rfi.submittedBy ?? '',
      assignedTo: rfi.assignedTo ?? '',
      dateSubmitted: rfi.createdAt ? new Date(rfi.createdAt).toISOString() : '',
      dateDue: rfi.dateDue ? new Date(rfi.dateDue).toISOString() : null,
      costImpact: rfi.costImpact ?? 'None',
      scheduleImpact: rfi.scheduleImpact ?? 'None',
    })),
    payApplications: (project.payApplications ?? []).map((pa: any) => ({
      id: pa.id,
      applicationNumber: pa.applicationNumber ?? 0,
      applicationDate: pa.applicationDate ? new Date(pa.applicationDate).toISOString() : '',
      periodFrom: pa.periodFrom ? new Date(pa.periodFrom).toISOString() : '',
      periodTo: pa.periodTo ? new Date(pa.periodTo).toISOString() : '',
      status: pa.status ?? 'Draft',
      lineItems: (pa.lineItems ?? []).map((li: any) => ({
        scheduledValue: li.scheduledValue ?? 0,
        budgetRealloc: li.budgetRealloc ?? 0,
        previousChanges: li.previousChanges ?? 0,
        currentChanges: li.currentChanges ?? 0,
        previousCompleted: li.previousCompleted ?? 0,
        thisCompleted: li.thisCompleted ?? 0,
        isSection: li.isSection ?? false,
        isFee: li.isFee ?? false,
        isBelowLine: li.isBelowLine ?? false,
      })),
    })),
    budgets: (project.budgets ?? []).map((b: any) => ({
      id: b.id,
      version: b.version ?? '',
      budgetDate: b.budgetDate ? new Date(b.budgetDate).toISOString() : '',
      status: b.status ?? 'Active',
      subTotalAll: b.subTotalAll ?? 0,
      opAmount: b.opAmount ?? 0,
      glAmount: b.glAmount ?? 0,
      contingencyAmount: b.contingencyAmount ?? 0,
      grandTotal: b.grandTotal ?? 0,
      _count: b._count ?? { lineItems: 0, detailItems: 0 },
    })),
    schedules: (project.schedules ?? []).map((s: any) => ({
      id: s.id,
      revision: s.revision ?? '',
      dataDate: s.dataDate ? new Date(s.dataDate).toISOString() : '',
      projectStart: s.projectStart ? new Date(s.projectStart).toISOString() : null,
      projectFinish: s.projectFinish ? new Date(s.projectFinish).toISOString() : null,
      tcoDate: s.tcoDate ? new Date(s.tcoDate).toISOString() : null,
      notes: s.notes ?? null,
      status: s.status ?? 'Active',
      activities: (s.activities ?? []).map((a: any) => ({
        id: a.id,
        sortOrder: a.sortOrder ?? 0,
        activityId: a.activityId ?? '',
        activityName: a.activityName ?? '',
        activityType: a.activityType ?? 'task',
        originalDuration: a.originalDuration ?? 0,
        remainingDuration: a.remainingDuration ?? 0,
        percentComplete: a.percentComplete ?? 0,
        startDate: a.startDate ? new Date(a.startDate).toISOString() : null,
        finishDate: a.finishDate ? new Date(a.finishDate).toISOString() : null,
        status: a.status ?? 'pend',
        isCritical: a.isCritical ?? false,
        isMilestone: a.isMilestone ?? false,
        notes: a.notes ?? null,
        wbsCode: a.wbsCode ?? '',
        resourceName: a.resourceName ?? '',
        costLoaded: a.costLoaded ?? 0,
        floatDays: a.floatDays ?? 0,
        isLookAhead: a.isLookAhead ?? false,
        parentActivityId: a.parentActivityId ?? null,
      })),
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
    })),
  };

  return <ProjectDetailContent project={serialized} initialTab={searchParams?.tab ?? 'overview'} />;
}
