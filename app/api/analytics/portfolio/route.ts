export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const projects = await prisma.project.findMany({
      where: { companyId },
      include: {
        changeOrders: { select: { id: true, status: true, totalAmount: true } },
        rfis: { select: { id: true, status: true } },
        payApplications: {
          select: {
            id: true,
            status: true,
            g702CurrentPaymentDue: true,
            g702TotalCompleted: true,
            applicationNumber: true,
          },
          orderBy: { applicationNumber: 'desc' },
        },
        submittals: { select: { id: true, status: true } },
      },
      orderBy: { projectNumber: 'asc' },
    });

    const projectRows = projects.map((p) => {
      const approvedCOs = p.changeOrders.filter((c) => c.status === 'Approved');
      const pendingCOs = p.changeOrders.filter((c) => c.status === 'Pending');
      const openRfis = p.rfis.filter((r) => r.status === 'Open' || r.status === 'Under Review');
      const latestPa = p.payApplications[0];
      const openSubmittals = p.submittals.filter(
        (s) => s.status === 'Submitted' || s.status === 'Under Review' || s.status === 'Revise and Resubmit',
      );

      return {
        id: p.id,
        projectNumber: p.projectNumber,
        projectName: p.projectName,
        client: p.client,
        contractAmount: p.contractAmount,
        totalCOs: p.changeOrders.length,
        approvedCOs: approvedCOs.length,
        pendingCOs: pendingCOs.length,
        approvedCOAmount: approvedCOs.reduce((s, c) => s + (c.totalAmount || 0), 0),
        pendingCOAmount: pendingCOs.reduce((s, c) => s + (c.totalAmount || 0), 0),
        totalRFIs: p.rfis.length,
        openRFIs: openRfis.length,
        totalPayApps: p.payApplications.length,
        latestPayAppNumber: latestPa?.applicationNumber ?? null,
        totalBilled: latestPa?.g702TotalCompleted ?? 0,
        currentPaymentDue: latestPa?.g702CurrentPaymentDue ?? 0,
        totalSubmittals: p.submittals.length,
        openSubmittals: openSubmittals.length,
      };
    });

    const summary = {
      totalProjects: projects.length,
      totalContractValue: projects.reduce((s, p) => s + (p.contractAmount || 0), 0),
      totalCOs: projectRows.reduce((s, p) => s + p.totalCOs, 0),
      approvedCOAmount: projectRows.reduce((s, p) => s + p.approvedCOAmount, 0),
      pendingCOAmount: projectRows.reduce((s, p) => s + p.pendingCOAmount, 0),
      totalRFIs: projectRows.reduce((s, p) => s + p.totalRFIs, 0),
      openRFIs: projectRows.reduce((s, p) => s + p.openRFIs, 0),
      totalPayApps: projectRows.reduce((s, p) => s + p.totalPayApps, 0),
      totalBilled: projectRows.reduce((s, p) => s + p.totalBilled, 0),
      totalSubmittals: projectRows.reduce((s, p) => s + p.totalSubmittals, 0),
      openSubmittals: projectRows.reduce((s, p) => s + p.openSubmittals, 0),
    };

    const corByProject = projectRows.map((p) => ({
      name: `#${p.projectNumber}`,
      approved: p.approvedCOs,
      pending: p.pendingCOs,
    }));

    const activityByProject = projectRows.map((p) => ({
      name: `#${p.projectNumber}`,
      rfis: p.openRFIs,
      submittals: p.openSubmittals,
      payApps: p.totalPayApps,
    }));

    return NextResponse.json({ summary, projects: projectRows, corByProject, activityByProject });
  } catch (error: any) {
    console.error('GET /api/analytics/portfolio error:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
