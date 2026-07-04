/**
 * Validate buyout totals vs latest Pay App per project.
 * Run: npx tsx -r dotenv/config scripts/validate-buyout-vs-pa.ts [projectNumber...]
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const args = process.argv.slice(2);

async function validate(projectNumber: string) {
  const proj = await p.project.findFirst({ where: { projectNumber } });
  if (!proj) {
    console.log(`\n#${projectNumber}: NOT FOUND`);
    return;
  }

  const pa = await p.payApplication.findFirst({
    where: { projectId: proj.id },
    orderBy: { applicationNumber: 'desc' },
  });

  const items = await p.buyoutItem.findMany({ where: { projectId: proj.id } });
  const trades = items.filter((i) => i.lineType !== 'Division');

  const buyoutBudget = trades.reduce((s, i) => s + i.totalValueBudget, 0);
  const buyoutInvested = trades.reduce((s, i) => s + i.cashFlowInvested, 0);
  const buyoutContracted = trades.reduce((s, i) => s + i.contractedValue, 0);
  const buyoutProposal = trades.reduce((s, i) => s + i.proposalAmount, 0);

  const paContract = pa?.g702ContractSumToDate ?? 0;
  const paCompleted = pa?.g702TotalCompleted ?? 0;

  const budgetDelta = buyoutBudget - paContract;
  const investedDelta = buyoutInvested - paCompleted;

  console.log(`\n=== #${projectNumber} ${proj.projectName} ===`);
  console.log(`  Buyout rows: ${items.length} (${trades.length} trades)`);
  console.log(`  Latest PA: #${pa?.applicationNumber ?? 'none'}`);
  console.log(`  Buyout total budget:  $${buyoutBudget.toLocaleString()}`);
  console.log(`  PA contract sum:      $${paContract.toLocaleString()}  (Δ $${budgetDelta.toLocaleString()})`);
  console.log(`  Buyout cash invested: $${buyoutInvested.toLocaleString()}`);
  console.log(`  PA completed:         $${paCompleted.toLocaleString()}  (Δ $${investedDelta.toLocaleString()})`);
  console.log(`  Buyout contracted:    $${buyoutContracted.toLocaleString()}`);
  console.log(`  Buyout proposal:      $${buyoutProposal.toLocaleString()}`);

  const budgetOk = Math.abs(budgetDelta) < paContract * 0.05 || paContract === 0;
  const investedOk = Math.abs(investedDelta) < paCompleted * 0.05 || paCompleted === 0;
  console.log(`  Status: budget ${budgetOk ? 'OK' : 'MISMATCH'} | invested ${investedOk ? 'OK' : 'MISMATCH'}`);
}

async function main() {
  const numbers = args.length ? args : ['176', '169'];
  for (const num of numbers) {
    await validate(num);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
