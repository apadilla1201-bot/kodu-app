/**
 * Sync Arena Madness (#169) buyout: regenerate from PA #12 + merge Excel dates/status.
 * Run: npx tsx -r dotenv/config scripts/sync-buyout-169.ts dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';
import { generateBuyoutFromBudgetLines } from '../lib/buyout-generate';
import { buyoutItemToMergeable, mergeExcelIntoGenerated } from '../lib/buyout-merge';

const p = new PrismaClient();
const PROJECT_NUMBER = '169';

async function main() {
  const proj = await p.project.findFirst({ where: { projectNumber: PROJECT_NUMBER } });
  if (!proj) throw new Error(`Project ${PROJECT_NUMBER} not found`);

  const existing = await p.buyoutItem.findMany({
    where: { projectId: proj.id },
    orderBy: { sortOrder: 'asc' },
  });
  const excelSnapshot = existing.map(buyoutItemToMergeable);
  console.log(`Excel snapshot: ${excelSnapshot.length} rows`);

  const latestPa = await p.payApplication.findFirst({
    where: { projectId: proj.id },
    orderBy: { applicationNumber: 'desc' },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!latestPa?.lineItems?.length) throw new Error('No Pay App found');

  const budgetLines = latestPa.lineItems.map((li) => ({
    sortOrder: li.sortOrder,
    itemNumber: li.itemNumber,
    sectionCode: li.sectionCode,
    sectionTitle: li.sectionTitle,
    description: li.description,
    subVendor: li.subVendor,
    scheduledValue: li.scheduledValue,
    budgetRealloc: li.budgetRealloc,
    previousChanges: li.previousChanges,
    currentChanges: li.currentChanges,
    previousCompleted: li.previousCompleted,
    thisCompleted: li.thisCompleted,
    isSection: li.isSection,
    isBelowLine: li.isBelowLine,
    isFee: li.isFee,
  }));

  const sched = await p.schedule.findFirst({
    where: { projectId: proj.id, status: 'Active' },
    include: { activities: true },
  });

  const cpm = (sched?.activities ?? [])
    .filter((a) => !a.isMilestone && a.activityType !== 'wbs')
    .map((a) => ({
      activityName: a.activityName,
      finishDate: a.finishDate,
      startDate: a.startDate,
      wbsCode: a.wbsCode,
      resourceName: a.resourceName,
    }));

  const generated = generateBuyoutFromBudgetLines(budgetLines, cpm);
  const { rows, mergedCount, excelOnlyCount } = mergeExcelIntoGenerated(generated, excelSnapshot);

  await p.buyoutItem.deleteMany({ where: { projectId: proj.id } });
  await p.buyoutItem.createMany({
    data: rows.map((row) => ({
      projectId: proj.id,
      sortOrder: row.sortOrder,
      lineType: row.lineType,
      divisionCode: row.divisionCode,
      trade: row.trade,
      status: row.status,
      proposalAmount: row.proposalAmount,
      potentialBuyoutAmount: row.potentialBuyoutAmount,
      contractedValue: row.contractedValue,
      pendingCor: row.pendingCor,
      changeOrders: row.changeOrders,
      totalValueBudget: row.totalValueBudget,
      totalByChapter: row.totalByChapter,
      cashFlowInvested: row.cashFlowInvested,
      subcontractor: row.subcontractor,
      targetContractDate: row.targetContractDate ?? null,
      actualContractDate: row.actualContractDate ?? null,
      dateSubOnSite: row.dateSubOnSite,
      finalOwnerApprovalDate: row.finalOwnerApprovalDate ?? null,
      finalSubmissionApprovalDate: row.finalSubmissionApprovalDate ?? null,
      forecastContractDate: row.forecastContractDate,
      forecastBidDate: row.forecastBidDate ?? null,
      awardDate: row.awardDate ?? null,
      notes: row.notes,
    })),
  });

  const tradeRows = rows.filter((r) => r.lineType !== 'Division');
  const totalBudget = tradeRows.reduce((s, r) => s + r.totalValueBudget, 0);
  const invested = tradeRows.reduce((s, r) => s + r.cashFlowInvested, 0);

  console.log(`OK: #${PROJECT_NUMBER} ${proj.projectName}`);
  console.log(`  PA #${latestPa.applicationNumber} → ${generated.length} generated rows`);
  console.log(`  Merged from Excel: ${mergedCount} | Excel-only appended: ${excelOnlyCount}`);
  console.log(`  Final rows: ${rows.length} | CPM dates: ${rows.filter((r) => r.dateSubOnSite).length}`);
  console.log(`  Total budget (trades): $${totalBudget.toLocaleString()}`);
  console.log(`  Cash invested (trades): $${invested.toLocaleString()}`);
  console.log(`  PA G702 contract sum: $${(latestPa.g702ContractSumToDate ?? 0).toLocaleString()}`);
  console.log(`  PA G702 completed: $${(latestPa.g702TotalCompleted ?? 0).toLocaleString()}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
