/**
 * Generate buyout for a project from latest Pay App / Budget.
 * Usage: npx tsx -r dotenv/config scripts/generate-buyout-project.ts 176 dotenv_config_path=.env.local
 */
import { PrismaClient } from '@prisma/client';
import { generateBuyoutFromBudgetLines } from '../lib/buyout-generate';

const p = new PrismaClient();
const projectNumber = process.argv[2] || '176';

async function main() {
  const proj = await p.project.findFirst({ where: { projectNumber } });
  if (!proj) throw new Error(`Project ${projectNumber} not found`);

  const latestPa = await p.payApplication.findFirst({
    where: { projectId: proj.id },
    orderBy: { applicationNumber: 'desc' },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  });

  let source = 'pay_app';
  let budgetLines = (latestPa?.lineItems ?? []).map((li) => ({
    sortOrder: li.sortOrder,
    itemNumber: li.itemNumber,
    sectionCode: li.sectionCode,
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

  if (!budgetLines.length) {
    const budget = await p.budget.findFirst({
      where: { projectId: proj.id },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!budget?.lineItems.length) throw new Error('No Pay App or Budget');
    source = 'budget';
    budgetLines = budget.lineItems.map((li) => ({
      sortOrder: li.sortOrder,
      itemNumber: li.itemNumber,
      sectionCode: li.divisionCode,
      description: li.description,
      subVendor: li.subVendor,
      scheduledValue: li.scheduledValue,
      budgetRealloc: 0,
      previousChanges: 0,
      currentChanges: li.currentChanges,
      previousCompleted: 0,
      thisCompleted: 0,
      isSection: li.isSection,
      isBelowLine: li.isBelowLine,
      isFee: li.isFee,
    }));
  }

  const sched = await p.schedule.findFirst({
    where: { projectId: proj.id, status: 'Active' },
    include: { activities: true },
  });

  const cpm = (sched?.activities ?? [])
    .filter((a) => !a.isMilestone)
    .map((a) => ({
      activityName: a.activityName,
      finishDate: a.finishDate,
      startDate: a.startDate,
      wbsCode: a.wbsCode,
      resourceName: a.resourceName,
    }));

  const generated = generateBuyoutFromBudgetLines(budgetLines, cpm);
  await p.buyoutItem.deleteMany({ where: { projectId: proj.id } });
  await p.buyoutItem.createMany({
    data: generated.map((row) => ({
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
      dateSubOnSite: row.dateSubOnSite,
      forecastContractDate: row.forecastContractDate,
      notes: row.notes,
    })),
  });

  console.log(`OK: #${projectNumber} ${proj.projectName}`);
  console.log(`  Source: ${source}${latestPa ? ` PA #${latestPa.applicationNumber}` : ''}`);
  console.log(`  Rows: ${generated.length} (${generated.filter((r) => r.lineType !== 'Division').length} trades)`);
  console.log(`  CPM dates matched: ${generated.filter((r) => r.dateSubOnSite).length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
