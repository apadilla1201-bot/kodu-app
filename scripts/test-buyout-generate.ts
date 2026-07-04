import { PrismaClient } from '@prisma/client';
import { generateBuyoutFromBudgetLines } from '../lib/buyout-generate';

const p = new PrismaClient();

async function inspectProjectNumber(num: string) {
  const proj = await p.project.findFirst({ where: { projectNumber: num } });
  if (!proj) {
    console.log(`Project ${num}: not found`);
    return;
  }
  console.log(`\n=== #${num} ${proj.projectName} (${proj.id}) ===`);

  const pa = await p.payApplication.findFirst({
    where: { projectId: proj.id },
    orderBy: { applicationNumber: 'desc' },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  });
  console.log('Latest PA:', pa?.applicationNumber ?? 'none', '| G703 lines:', pa?.lineItems?.length ?? 0);

  const budget = await p.budget.findFirst({
    where: { projectId: proj.id },
    include: { _count: { select: { lineItems: true } } },
  });
  console.log('Budget lines:', budget?._count?.lineItems ?? 0);

  const sched = await p.schedule.findFirst({
    where: { projectId: proj.id, status: 'Active' },
    include: { activities: true },
  });
  console.log('CPM:', sched?.revision ?? 'none', '| activities:', sched?.activities?.length ?? 0);

  const buyoutCount = await p.buyoutItem.count({ where: { projectId: proj.id } });
  console.log('Existing buyout rows:', buyoutCount);

  const sourceLines = pa?.lineItems?.length
    ? pa.lineItems.map((li) => ({
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
      }))
    : [];

  if (!sourceLines.length && budget?.id) {
    const bl = await p.budgetLineItem.findMany({ where: { budgetId: budget.id }, orderBy: { sortOrder: 'asc' } });
    sourceLines.push(...bl.map((li) => ({
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
    })));
  }

  if (!sourceLines.length) {
    console.log('No source lines to generate from');
    return;
  }

  const cpmActs = (sched?.activities ?? [])
    .filter((a) => !a.isMilestone)
    .map((a) => ({ activityName: a.activityName, finishDate: a.finishDate, startDate: a.startDate, wbsCode: a.wbsCode, resourceName: a.resourceName }));

  const gen = generateBuyoutFromBudgetLines(sourceLines, cpmActs);
  const divisions = gen.filter((r) => r.lineType === 'Division').length;
  const trades = gen.filter((r) => r.lineType === 'Trade').length;
  const totalBudget = gen.filter((r) => r.lineType !== 'Division').reduce((s, r) => s + r.totalValueBudget, 0);
  console.log('Generated preview:', gen.length, 'rows (', divisions, 'divisions,', trades, 'trades)');
  console.log('Total budget (non-div):', totalBudget.toLocaleString());
  console.log('CPM date matches:', gen.filter((r) => r.dateSubOnSite).length);
  console.log('Sample trades:');
  gen.filter((r) => r.lineType === 'Trade').slice(0, 4).forEach((r) =>
    console.log(' ', r.divisionCode, '|', r.trade.slice(0, 45), '|', r.totalValueBudget, '| sub:', r.subcontractor?.slice(0, 20))
  );
}

async function main() {
  for (const num of ['176', '169']) {
    await inspectProjectNumber(num);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
