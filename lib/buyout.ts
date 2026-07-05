/** Buyout / Contract Tracking helpers */

export const BUYOUT_STATUSES = [
  'Not Started',
  'Design Pending',
  'Bidding',
  'Pending Owner Approval',
  'Awarded',
  'Contracted',
  'On Site',
  'Complete',
] as const;

export type BuyoutStatus = (typeof BUYOUT_STATUSES)[number];

export function computeBudget(item: {
  contractedValue?: number | null;
  pendingCor?: number | null;
  changeOrders?: number | null;
  proposalAmount?: number | null;
  potentialBuyoutAmount?: number | null;
}): number {
  const contracted = item.contractedValue ?? 0;
  const pending = item.pendingCor ?? 0;
  const cos = item.changeOrders ?? 0;
  if (contracted || pending || cos) return contracted + pending + cos;
  const buyout = item.potentialBuyoutAmount ?? 0;
  if (buyout) return buyout;
  return item.proposalAmount ?? 0;
}

export function computeRemaining(totalBudget: number, cashInvested: number): number {
  return totalBudget - cashInvested;
}

export function computeRemainingPct(totalBudget: number, cashInvested: number): number {
  if (!totalBudget) return 0;
  return cashInvested / totalBudget;
}

export function computeDelta(totalBudget: number, proposalAmount: number): number {
  return totalBudget - proposalAmount;
}

/** G703 revised scheduled value for one line. */
export function revisedScheduled(line: {
  scheduledValue?: number | null;
  budgetRealloc?: number | null;
  previousChanges?: number | null;
  currentChanges?: number | null;
}): number {
  return (
    (line.scheduledValue ?? 0) +
    (line.budgetRealloc ?? 0) +
    (line.previousChanges ?? 0) +
    (line.currentChanges ?? 0)
  );
}

export function isPayAppWorkLine(line: {
  isSection?: boolean | null;
  isFee?: boolean | null;
  isBelowLine?: boolean | null;
}): boolean {
  return !line.isSection && !line.isFee && !line.isBelowLine;
}

/** Sum G703 revised values (construction work lines only). */
export function sumPayAppRevised(
  lines: Array<{
    scheduledValue?: number | null;
    budgetRealloc?: number | null;
    previousChanges?: number | null;
    currentChanges?: number | null;
    isSection?: boolean | null;
    isFee?: boolean | null;
    isBelowLine?: boolean | null;
  }>,
): number {
  return lines
    .filter(isPayAppWorkLine)
    .reduce((s, li) => s + revisedScheduled(li), 0);
}

/** Sum G703 completed-to-date (previous + this period). */
export function sumPayAppCompleted(
  lines: Array<{
    previousCompleted?: number | null;
    thisCompleted?: number | null;
    isSection?: boolean | null;
    isFee?: boolean | null;
    isBelowLine?: boolean | null;
  }>,
): number {
  return lines
    .filter(isPayAppWorkLine)
    .reduce((s, li) => s + (li.previousCompleted ?? 0) + (li.thisCompleted ?? 0), 0);
}

/** Sum G703 revised values for lines with billing activity (contracted / in progress). */
export function sumPayAppContracted(
  lines: Array<{
    scheduledValue?: number | null;
    budgetRealloc?: number | null;
    previousChanges?: number | null;
    currentChanges?: number | null;
    previousCompleted?: number | null;
    thisCompleted?: number | null;
    isSection?: boolean | null;
    isFee?: boolean | null;
    isBelowLine?: boolean | null;
  }>,
): number {
  return lines
    .filter(isPayAppWorkLine)
    .reduce((s, li) => {
      const invested = (li.previousCompleted ?? 0) + (li.thisCompleted ?? 0);
      return s + (invested > 0 ? revisedScheduled(li) : 0);
    }, 0);
}

/** Excel-only rows appended outside Pay App scope — exclude from contract KPI rollups. */
export function isExcelOnlyBuyoutRow(notes: string | null | undefined): boolean {
  return !!notes?.includes('[Excel procurement — not in Pay App scope]');
}

/** Buyout log lines that roll up to KPI totals (exclude division headers). */
export function isBuyoutKpiLine(lineType: string): boolean {
  return lineType !== 'Division';
}

/** PA-scoped buyout lines for KPI totals when a Pay App exists. */
export function isPaScopedBuyoutLine(item: { lineType: string; notes?: string | null }): boolean {
  return isBuyoutKpiLine(item.lineType) && !isExcelOnlyBuyoutRow(item.notes);
}

/** Infer status from subcontractor notes + dates (matches Arena Madness spreadsheet language). */
export function inferStatus(row: {
  subcontractor?: string | null;
  awardDate?: Date | string | null;
  contractedValue?: number | null;
  dateSubOnSite?: Date | string | null;
  finalOwnerApprovalDate?: Date | string | null;
  lineType?: string | null;
}): BuyoutStatus {
  if (row.lineType === 'Division') return 'Not Started';
  const sub = (row.subcontractor ?? '').toUpperCase();
  if (sub.includes('DESIGN PENDING')) return 'Design Pending';
  if (sub.includes('BIDDING')) return 'Bidding';
  if (sub.includes('WAITING')) return 'Pending Owner Approval';

  const hasAward = !!row.awardDate && String(row.awardDate) !== '00:00:00';
  const contracted = (row.contractedValue ?? 0) > 0;
  const onSite = !!row.dateSubOnSite;

  if (onSite && contracted) return 'On Site';
  if (hasAward && contracted) return 'Contracted';
  if (hasAward) return 'Awarded';
  if (row.finalOwnerApprovalDate && !hasAward) return 'Pending Owner Approval';
  if (contracted) return 'Contracted';
  return 'Not Started';
}

export function classifyLineType(trade: string): 'Division' | 'Trade' | 'COR' | 'GC' | 'Allowance' {
  const t = trade.trim();
  const u = t.toUpperCase();
  if (u.startsWith('DIV ') || u.startsWith('DIVISION') || u.startsWith('DIV.')) return 'Division';
  if (u.startsWith('COR ') || u.startsWith('C0R ') || /^COR\s*\d/i.test(t)) return 'COR';
  if (u.includes('GENERAL CONDITIONS') || u.includes('SUPPORT CONDITIONS')) return 'GC';
  if (u.includes('ALLOWANCE')) return 'Allowance';
  return 'Trade';
}

export function parseDivisionCode(trade: string): string | null {
  const m = trade.match(/DIV(?:ISION)?\.?\s*(\d{2}(?:\s*[,&]\s*\d{2})*)/i);
  return m ? `DIV ${m[1].replace(/\s+/g, ' ')}` : null;
}

export function isValidDate(v: unknown): v is Date {
  if (!v) return false;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return false;
    // Excel sometimes stores time-only as 1899/1900 epoch
    if (v.getFullYear() < 1990) return false;
    return true;
  }
  return false;
}

export function toDateOrNull(v: unknown): Date | null {
  if (!isValidDate(v)) return null;
  return v;
}

export interface BuyoutAlert {
  id: string;
  trade: string;
  type: 'owner_approval_overdue' | 'sub_on_site_overdue' | 'design_pending' | 'over_budget';
  message: string;
  severity: 'high' | 'medium' | 'low';
}

export function buildAlerts(
  items: Array<{
    id: string;
    trade: string;
    lineType: string;
    status: string;
    finalOwnerApprovalDate: Date | string | null;
    dateSubOnSite: Date | string | null;
    awardDate: Date | string | null;
    contractedValue: number;
    proposalAmount: number;
    totalValueBudget: number;
  }>,
  now = new Date()
): BuyoutAlert[] {
  const alerts: BuyoutAlert[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const item of items) {
    if (item.lineType === 'Division' || item.lineType === 'COR' || item.lineType === 'GC') continue;

    const isActiveProcurement =
      item.status !== 'Not Started' ||
      item.contractedValue > 0 ||
      !!item.awardDate ||
      (item.proposalAmount > 0 && !!item.trade.trim());

    if (!isActiveProcurement) continue;

    if (item.status === 'Design Pending') {
      alerts.push({
        id: item.id,
        trade: item.trade,
        type: 'design_pending',
        message: 'Design pending — cannot bid or award',
        severity: 'medium',
      });
      continue;
    }

    const ownerDate = item.finalOwnerApprovalDate ? new Date(item.finalOwnerApprovalDate) : null;
    const needsOwnerApproval =
      item.status === 'Pending Owner Approval' ||
      item.status === 'Bidding' ||
      (item.proposalAmount > 0 && !item.awardDate && item.contractedValue === 0);

    if (
      ownerDate &&
      ownerDate < today &&
      needsOwnerApproval &&
      !item.awardDate &&
      item.status !== 'Contracted' &&
      item.status !== 'On Site' &&
      item.status !== 'Complete' &&
      item.status !== 'Awarded'
    ) {
      alerts.push({
        id: item.id,
        trade: item.trade,
        type: 'owner_approval_overdue',
        message: `Owner approval was due ${ownerDate.toLocaleDateString('en-US')}`,
        severity: 'high',
      });
    }

    const onSite = item.dateSubOnSite ? new Date(item.dateSubOnSite) : null;
    const procurementStarted =
      !!item.awardDate ||
      item.contractedValue > 0 ||
      ['Awarded', 'Contracted', 'Bidding', 'On Site'].includes(item.status);

    if (
      onSite &&
      onSite < today &&
      procurementStarted &&
      item.status !== 'On Site' &&
      item.status !== 'Complete'
    ) {
      alerts.push({
        id: item.id,
        trade: item.trade,
        type: 'sub_on_site_overdue',
        message: `Sub/material on-site was due ${onSite.toLocaleDateString('en-US')}`,
        severity: 'high',
      });
    }

    if (
      item.proposalAmount >= 5000 &&
      item.contractedValue > 0 &&
      item.totalValueBudget > item.proposalAmount * 1.1
    ) {
      const over = item.totalValueBudget - item.proposalAmount;
      alerts.push({
        id: item.id,
        trade: item.trade,
        type: 'over_budget',
        message: `Over proposal by $${over.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        severity: 'low',
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
