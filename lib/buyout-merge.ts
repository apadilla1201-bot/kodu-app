import { computeBudget, inferStatus } from './buyout';

export type MergeableBuyoutRow = {
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
  targetContractDate?: Date | null;
  actualContractDate?: Date | null;
  dateSubOnSite?: Date | null;
  finalOwnerApprovalDate?: Date | null;
  finalSubmissionApprovalDate?: Date | null;
  awardDate?: Date | null;
  forecastContractDate?: Date | null;
  forecastBidDate?: Date | null;
  notes: string | null;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(s: string): string[] {
  return norm(s).split(/\s+/).filter((t) => t.length > 2);
}

function matchScore(gen: MergeableBuyoutRow, excel: MergeableBuyoutRow): number {
  if (gen.lineType === 'Division' || excel.lineType === 'Division') return 0;

  let score = 0;
  const gTrade = norm(gen.trade);
  const eTrade = norm(excel.trade);
  if (gTrade === eTrade) score += 20;
  else if (gTrade.includes(eTrade) || eTrade.includes(gTrade)) score += 12;

  for (const t of tokens(gen.trade)) {
    if (tokens(excel.trade).some((et) => et === t || et.includes(t) || t.includes(et))) score += 2;
  }

  if (gen.divisionCode && excel.divisionCode) {
    const gDiv = norm(String(gen.divisionCode));
    const eDiv = norm(String(excel.divisionCode));
    if (gDiv === eDiv || gDiv.includes(eDiv) || eDiv.includes(gDiv)) score += 4;
  }

  const gSub = norm(gen.subcontractor || '');
  const eSub = norm(excel.subcontractor || '');
  if (gSub && eSub && (gSub === eSub || gSub.includes(eSub) || eSub.includes(gSub))) score += 5;

  return score;
}

/** Merge Excel procurement dates/status into PA-generated rows; append unmatched Excel trades. */
export function mergeExcelIntoGenerated(
  generated: MergeableBuyoutRow[],
  excelRows: MergeableBuyoutRow[],
): { rows: MergeableBuyoutRow[]; mergedCount: number; excelOnlyCount: number } {
  const usedExcel = new Set<number>();
  let mergedCount = 0;

  const merged = generated.map((gen) => {
    if (gen.lineType === 'Division') return { ...gen };

    let bestIdx = -1;
    let bestScore = 0;
    excelRows.forEach((ex, idx) => {
      if (usedExcel.has(idx)) return;
      const s = matchScore(gen, ex);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = idx;
      }
    });

    if (bestIdx < 0 || bestScore < 8) return { ...gen };

    usedExcel.add(bestIdx);
    mergedCount++;
    const ex = excelRows[bestIdx];

    const subcontractor = ex.subcontractor?.trim() || gen.subcontractor;
    const contractedValue = gen.contractedValue > 0 ? gen.contractedValue : (ex.contractedValue || 0);
    const proposalAmount = ex.proposalAmount > 0 ? ex.proposalAmount : gen.proposalAmount;
    const potentialBuyoutAmount =
      ex.potentialBuyoutAmount > 0 ? ex.potentialBuyoutAmount : gen.potentialBuyoutAmount;

    const mergedRow: MergeableBuyoutRow = {
      ...gen,
      status: ex.status && ex.status !== 'Not Started' ? ex.status : gen.status,
      proposalAmount,
      potentialBuyoutAmount,
      contractedValue,
      subcontractor,
      targetContractDate: ex.targetContractDate ?? gen.targetContractDate ?? null,
      actualContractDate: ex.actualContractDate ?? gen.actualContractDate ?? null,
      dateSubOnSite: ex.dateSubOnSite ?? gen.dateSubOnSite ?? null,
      finalOwnerApprovalDate: ex.finalOwnerApprovalDate ?? gen.finalOwnerApprovalDate ?? null,
      finalSubmissionApprovalDate: ex.finalSubmissionApprovalDate ?? gen.finalSubmissionApprovalDate ?? null,
      awardDate: ex.awardDate ?? gen.awardDate ?? null,
      forecastContractDate: ex.forecastContractDate ?? gen.forecastContractDate ?? null,
      forecastBidDate: ex.forecastBidDate ?? gen.forecastBidDate ?? null,
      notes: ex.notes && !ex.notes.includes('Generated from budget') ? ex.notes : gen.notes,
      totalValueBudget: computeBudget({ contractedValue, proposalAmount, potentialBuyoutAmount }),
      cashFlowInvested: gen.cashFlowInvested,
    };

    mergedRow.status = inferStatus({
      subcontractor: mergedRow.subcontractor,
      awardDate: mergedRow.awardDate,
      contractedValue: mergedRow.contractedValue,
      dateSubOnSite: mergedRow.dateSubOnSite,
      finalOwnerApprovalDate: mergedRow.finalOwnerApprovalDate,
      lineType: mergedRow.lineType,
    });

    return mergedRow;
  });

  const excelOnly: MergeableBuyoutRow[] = [];
  excelRows.forEach((ex, idx) => {
    if (usedExcel.has(idx) || ex.lineType === 'Division') return;
    excelOnly.push({
      ...ex,
      sortOrder: 0,
      notes: ex.notes
        ? `${ex.notes} [Excel procurement — not in Pay App scope]`
        : '[Excel procurement — not in Pay App scope]',
    });
  });

  const rows = [...merged, ...excelOnly].map((r, i) => ({ ...r, sortOrder: i + 1 }));

  return { rows, mergedCount, excelOnlyCount: excelOnly.length };
}

export function buyoutItemToMergeable(item: {
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
  targetContractDate?: Date | null;
  actualContractDate?: Date | null;
  dateSubOnSite?: Date | null;
  finalOwnerApprovalDate?: Date | null;
  finalSubmissionApprovalDate?: Date | null;
  awardDate?: Date | null;
  forecastContractDate?: Date | null;
  forecastBidDate?: Date | null;
  notes: string | null;
}): MergeableBuyoutRow {
  return { ...item };
}
