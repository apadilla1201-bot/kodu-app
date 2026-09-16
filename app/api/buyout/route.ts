export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import {
  buildAlerts,
  computeBudget,
  computeDelta,
  computeRemaining,
  computeRemainingPct,
  isBuyoutKpiLine,
  isPaScopedBuyoutLine,
  sumPayAppCompleted,
  sumPayAppContracted,
  sumPayAppRevised,
} from '@/lib/buyout';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const items = await prisma.buyoutItem.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });

    // Cash Invested = executed-to-date from LATEST Pay Application (G702 / G703), never Excel column
    const latestPa = await prisma.payApplication.findFirst({
      where: { projectId },
      orderBy: { applicationNumber: 'desc' },
      include: {
        lineItems: { where: { isSection: false } },
      },
    });

    let totalInvested = 0;
    let contractBudget = 0;
    let investedFromPa: {
      applicationNumber: number;
      g702TotalCompleted: number | null;
      g702ContractSumToDate: number | null;
    } | null = null;

    if (latestPa) {
      const paLines = latestPa.lineItems;
      const paRevisedSum = sumPayAppRevised(paLines);
      const paCompletedSum = sumPayAppCompleted(paLines);

      contractBudget =
        latestPa.g702ContractSumToDate != null && latestPa.g702ContractSumToDate > 0
          ? latestPa.g702ContractSumToDate
          : paRevisedSum;

      totalInvested =
        latestPa.g702TotalCompleted != null && latestPa.g702TotalCompleted > 0
          ? latestPa.g702TotalCompleted
          : paCompletedSum;

      investedFromPa = {
        applicationNumber: latestPa.applicationNumber,
        g702TotalCompleted: latestPa.g702TotalCompleted,
        g702ContractSumToDate: latestPa.g702ContractSumToDate,
      };
    }

    // CORs from the Change Order table: approved (added to real total) vs pending (informational only)
    const cors = await prisma.changeOrder.findMany({
      where: { projectId },
      select: { status: true, totalAmount: true },
    });
    const totalCorApproved = cors
      .filter((c) => c.status === 'Approved')
      .reduce((s, c) => s + (c.totalAmount || 0), 0);
    const totalCorPending = cors
      .filter((c) => c.status === 'Pending')
      .reduce((s, c) => s + (c.totalAmount || 0), 0);
    const corCountApproved = cors.filter((c) => c.status === 'Approved').length;
    const corCountPending = cors.filter((c) => c.status === 'Pending').length;

    // Cash flow movements: one row per Pay Application (monthly outputs + faltante comparison)
    const payApps = await prisma.payApplication.findMany({
      where: { projectId },
      orderBy: { applicationNumber: 'asc' },
      include: { lineItems: { where: { isSection: false } } },
    });
    let prevCompleted = 0;
    const cashFlow = payApps.map((pa) => {
      const completed =
        pa.g702TotalCompleted != null && pa.g702TotalCompleted > 0
          ? pa.g702TotalCompleted
          : sumPayAppCompleted(pa.lineItems);
      const contractSum =
        pa.g702ContractSumToDate != null && pa.g702ContractSumToDate > 0
          ? pa.g702ContractSumToDate
          : sumPayAppRevised(pa.lineItems);
      const periodExecuted = Math.max(0, completed - prevCompleted);
      prevCompleted = completed;
      return {
        applicationNumber: pa.applicationNumber,
        periodFrom: pa.periodFrom,
        periodTo: pa.periodTo,
        periodExecuted,
        cumulativeExecuted: completed,
        contractSumToDate: contractSum,
      };
    });

    const kpiLines = items.filter((i) => isBuyoutKpiLine(i.lineType));
    const paScopedLines = kpiLines.filter((i) => isPaScopedBuyoutLine(i));

    const logProposal = kpiLines.reduce((s, i) => s + (i.proposalAmount || 0), 0);
    const logContracted = kpiLines.reduce((s, i) => s + (i.contractedValue || 0), 0);
    const logBudget = kpiLines.reduce((s, i) => s + (i.totalValueBudget || 0), 0);
    const excelInvested = paScopedLines.reduce((s, i) => s + (i.cashFlowInvested || 0), 0);

    let procurementProposal = logProposal;
    let procurementContracted = logContracted;
    let procurementBudget = logBudget;

    if (latestPa) {
      const paLines = latestPa.lineItems;
      const paRevisedSum = sumPayAppRevised(paLines);
      procurementProposal = paRevisedSum;
      procurementContracted = sumPayAppContracted(paLines);
      procurementBudget = paRevisedSum;
    }

    if (!investedFromPa) {
      contractBudget = procurementBudget;
      totalInvested = excelInvested;
    }

    const totalBudget = contractBudget;

    // Net change by change orders already embedded in the PA (G702 line 2 = line 3 - line 1).
    // Excel-imported PAs (projects started before koduPM, e.g. Arena Madness) already carry
    // approved CORs inside the contract sum — never double-count them on top of the COR table.
    const paNetChangeCo =
      latestPa && contractBudget > 0
        ? Math.max(
            0,
            latestPa.g702NetChange != null
              ? latestPa.g702NetChange
              : contractBudget - (latestPa.originalContractSum || 0)
          )
        : 0;
    const corAlreadyIncluded = Math.min(totalCorApproved, paNetChangeCo);
    const corApprovedExtra = totalCorApproved - corAlreadyIncluded;
    const realProjectTotal = totalBudget + corApprovedExtra;

    const totalRemaining = computeRemaining(totalBudget, totalInvested);
    const lineItems = investedFromPa ? paScopedLines : kpiLines;

    // Scale division invested so chart totals match PA executed amount
    const scale =
      excelInvested > 0 && investedFromPa ? totalInvested / excelInvested : 1;

    const byDivision = items
      .filter((i) => i.lineType === 'Division')
      .map((d) => {
        const code = d.divisionCode || d.trade;
        const children = lineItems.filter((i) => i.divisionCode === code || i.divisionCode === d.trade);
        const investedRaw = children.reduce((s, i) => s + (i.cashFlowInvested || 0), 0);
        const invested = investedRaw * scale;
        const budget = d.totalByChapter || children.reduce((s, i) => s + (i.totalValueBudget || 0), 0);
        return {
          name: d.trade,
          code,
          budget,
          invested,
          remaining: budget - invested,
        };
      });

    const alerts = buildAlerts(items);

    const summary = {
      totalLines: lineItems.length,
      totalProposal: procurementProposal,
      totalContracted: procurementContracted,
      totalBudget,
      totalInvested,
      totalRemaining,
      remainingPct: computeRemainingPct(totalBudget, totalInvested),
      delta: computeDelta(procurementBudget, procurementProposal),
      procurementBudget,
      procurementProposal,
      procurementContracted,
      procurementLogProposal: logProposal,
      procurementLogContracted: logContracted,
      procurementLogBudget: logBudget,
      alertCount: alerts.length,
      highAlerts: alerts.filter((a) => a.severity === 'high').length,
      investedSource: investedFromPa
        ? `PA #${investedFromPa.applicationNumber}`
        : 'Buyout lines (no pay app)',
      budgetSource: investedFromPa
        ? `PA #${investedFromPa.applicationNumber} contract`
        : 'Buyout log',
      latestPayAppNumber: investedFromPa?.applicationNumber ?? null,
      contractSumToDate: investedFromPa?.g702ContractSumToDate ?? null,
      totalCorApproved,
      totalCorPending,
      corCountApproved,
      corCountPending,
      realProjectTotal,
      realRemainingToExecute: realProjectTotal - totalInvested,
      corAlreadyIncluded,
      paNetChangeCo,
    };

    return NextResponse.json({
      project: {
        id: project.id,
        projectNumber: project.projectNumber,
        projectName: project.projectName,
      },
      items,
      summary,
      byDivision,
      alerts,
      cashFlow,
    });
  } catch (error: any) {
    console.error('GET /api/buyout error:', error);
    return NextResponse.json({ error: 'Failed to load buyout' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json();
    const { projectId, ...fields } = body ?? {};
    if (!projectId || !fields.trade) {
      return NextResponse.json({ error: 'projectId and trade are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const last = await prisma.buyoutItem.findFirst({
      where: { projectId },
      orderBy: { sortOrder: 'desc' },
    });

    const totalValueBudget =
      fields.totalValueBudget ??
      computeBudget({
        contractedValue: fields.contractedValue,
        pendingCor: fields.pendingCor,
        changeOrders: fields.changeOrders,
        proposalAmount: fields.proposalAmount,
        potentialBuyoutAmount: fields.potentialBuyoutAmount,
      });

    const item = await prisma.buyoutItem.create({
      data: {
        projectId,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        lineType: fields.lineType ?? 'Trade',
        divisionCode: fields.divisionCode ?? null,
        trade: String(fields.trade),
        status: fields.status ?? 'Not Started',
        proposalAmount: fields.proposalAmount ?? 0,
        proposalDetails: fields.proposalDetails ?? null,
        potentialBuyoutAmount: fields.potentialBuyoutAmount ?? 0,
        potentialBuyoutDetails: fields.potentialBuyoutDetails ?? null,
        contractedValue: fields.contractedValue ?? 0,
        pendingCor: fields.pendingCor ?? 0,
        changeOrders: fields.changeOrders ?? 0,
        totalValueBudget,
        totalByChapter: fields.totalByChapter ?? null,
        cashFlowInvested: fields.cashFlowInvested ?? 0,
        targetContractDate: fields.targetContractDate ? new Date(fields.targetContractDate) : null,
        actualContractDate: fields.actualContractDate ? new Date(fields.actualContractDate) : null,
        dateSubOnSite: fields.dateSubOnSite ? new Date(fields.dateSubOnSite) : null,
        productLeadTimeDays: fields.productLeadTimeDays ?? null,
        approvalLeadTimeDays: fields.approvalLeadTimeDays ?? null,
        finalOwnerApprovalDate: fields.finalOwnerApprovalDate
          ? new Date(fields.finalOwnerApprovalDate)
          : null,
        finalSubmissionApprovalDate: fields.finalSubmissionApprovalDate
          ? new Date(fields.finalSubmissionApprovalDate)
          : null,
        forecastBidDate: fields.forecastBidDate ? new Date(fields.forecastBidDate) : null,
        forecastContractDate: fields.forecastContractDate
          ? new Date(fields.forecastContractDate)
          : null,
        awardDate: fields.awardDate ? new Date(fields.awardDate) : null,
        subcontractor: fields.subcontractor ?? null,
        notes: fields.notes ?? null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/buyout error:', error);
    return NextResponse.json({ error: 'Failed to create buyout item' }, { status: 500 });
  }
}
