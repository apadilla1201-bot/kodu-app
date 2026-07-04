/**
 * Build Buyout rows from Pay App G703 lines (preferred) or project Budget.
 * Lines mirror the pay application budget so Cash Invested stays aligned.
 */
import { classifyLineType, computeBudget, inferStatus } from '@/lib/buyout';

export type BudgetSourceLine = {
  sortOrder: number;
  itemNumber?: string;
  sectionCode?: string;
  sectionTitle?: string;
  description: string;
  subVendor?: string;
  scheduledValue: number;
  budgetRealloc?: number;
  previousChanges?: number;
  currentChanges?: number;
  previousCompleted?: number;
  thisCompleted?: number;
  isSection?: boolean;
  isBelowLine?: boolean;
  isFee?: boolean;
};

export type CpmActivity = {
  activityName: string;
  finishDate?: Date | null;
  startDate?: Date | null;
};

export type GeneratedBuyoutRow = {
  sortOrder: number;
  lineType: string;
  divisionCode: string | null;
  trade: string;
  status: string;
  proposalAmount: number;
  potentialBuyoutAmount: number;
  contractedValue: number;
  pendingCor: number;
  changeOrders: number;
  totalValueBudget: number;
  totalByChapter: number | null;
  cashFlowInvested: number;
  subcontractor: string | null;
  dateSubOnSite: Date | null;
  forecastContractDate: Date | null;
  notes: string | null;
};

function revisedValue(li: BudgetSourceLine): number {
  return (
    (li.scheduledValue || 0) +
    (li.budgetRealloc || 0) +
    (li.previousChanges || 0) +
    (li.currentChanges || 0)
  );
}

function investedToDate(li: BudgetSourceLine): number {
  return (li.previousCompleted || 0) + (li.thisCompleted || 0);
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findCpmMatch(description: string, activities: CpmActivity[]): CpmActivity | null {
  const d = norm(description);
  if (!d) return null;
  let best: CpmActivity | null = null;
  let bestScore = 0;
  for (const a of activities) {
    const n = norm(a.activityName);
    if (!n) continue;
    if (n === d || n.includes(d) || d.includes(n)) {
      const score = Math.min(n.length, d.length);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
  }
  return best;
}

export function generateBuyoutFromBudgetLines(
  lines: BudgetSourceLine[],
  cpmActivities: CpmActivity[] = [],
): GeneratedBuyoutRow[] {
  const rows: GeneratedBuyoutRow[] = [];
  let currentDivision: string | null = null;
  let divisionTradeLines: GeneratedBuyoutRow[] = [];

  const flushDivision = () => {
    if (!currentDivision || divisionTradeLines.length === 0) return;
    const chapterTotal = divisionTradeLines.reduce((s, r) => s + r.totalValueBudget, 0);
    const divRow = rows.find((r) => r.lineType === 'Division' && r.trade === currentDivision);
    if (divRow) divRow.totalByChapter = chapterTotal;
    divisionTradeLines = [];
  };

  for (const li of [...lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (li.isFee || li.isBelowLine) continue;

    const desc = String(li.description || '').trim();
    if (!desc) continue;

    if (li.isSection) {
      flushDivision();
      currentDivision = desc;
      const lineType = classifyLineType(desc);
      rows.push({
        sortOrder: rows.length + 1,
        lineType: lineType === 'Trade' ? 'Division' : lineType,
        divisionCode: li.sectionCode || li.itemNumber || null,
        trade: desc,
        status: 'Not Started',
        proposalAmount: 0,
        potentialBuyoutAmount: 0,
        contractedValue: 0,
        pendingCor: 0,
        changeOrders: (li.currentChanges || 0) + (li.previousChanges || 0),
        totalValueBudget: 0,
        totalByChapter: null,
        cashFlowInvested: 0,
        subcontractor: null,
        dateSubOnSite: null,
        forecastContractDate: null,
        notes: 'Generated from budget / pay app',
      });
      continue;
    }

    const revised = revisedValue(li);
    const invested = investedToDate(li);
    const lineType = classifyLineType(desc);
    const cpm = findCpmMatch(desc, cpmActivities);

    const row: GeneratedBuyoutRow = {
      sortOrder: rows.length + 1,
      lineType,
      divisionCode: li.sectionCode || currentDivision,
      trade: desc,
      status: 'Not Started',
      proposalAmount: revised,
      potentialBuyoutAmount: revised,
      contractedValue: invested > 0 ? revised : 0,
      pendingCor: 0,
      changeOrders: (li.currentChanges || 0) + (li.previousChanges || 0),
      totalValueBudget: computeBudget({
        contractedValue: invested > 0 ? revised : 0,
        proposalAmount: revised,
        potentialBuyoutAmount: revised,
      }),
      totalByChapter: null,
      cashFlowInvested: invested,
      subcontractor: li.subVendor?.trim() || null,
      dateSubOnSite: cpm?.finishDate ?? null,
      forecastContractDate: cpm?.startDate ?? null,
      notes: 'Generated from budget / pay app — edit dates & status manually',
    };

    row.status = inferStatus({
      subcontractor: row.subcontractor,
      contractedValue: row.contractedValue,
      dateSubOnSite: row.dateSubOnSite,
      lineType: row.lineType,
      awardDate: null,
      finalOwnerApprovalDate: null,
    });

    rows.push(row);
    if (currentDivision) divisionTradeLines.push(row);
  }

  flushDivision();
  return rows;
}
