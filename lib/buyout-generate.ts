/**
 * Build Buyout rows from Pay App G703 lines (preferred) or project Budget.
 * Lines mirror the pay application budget so Cash Invested stays aligned.
 */
import { classifyLineType, computeBudget, inferStatus, parseDivisionCode } from '@/lib/buyout';

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
  wbsCode?: string;
  resourceName?: string;
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

const CSI_DIVISION_NAMES: Record<string, string> = {
  '01': 'General Requirements',
  '02': 'Existing Conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood, Plastics & Composites',
  '07': 'Thermal & Moisture Protection',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '12': 'Furnishings',
  '13': 'Special Construction',
  '14': 'Conveying Equipment',
  '21': 'Fire Suppression',
  '22': 'Plumbing',
  '23': 'HVAC',
  '26': 'Electrical',
  '27': 'Communications',
  '28': 'Electronic Safety & Security',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities',
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

function tokens(s: string): string[] {
  return norm(s).split(/\s+/).filter((t) => t.length > 2);
}

/** Extract division code from G703 line (1000, 2000, CSI 01, etc.). */
export function extractDivisionCode(li: BudgetSourceLine): string | null {
  if (li.sectionCode?.trim()) return li.sectionCode.trim();

  const item = (li.itemNumber || '').trim();
  const csi = item.match(/^(\d{2})\s+\d{2}\s+\d{2}/);
  if (csi) return csi[1];

  const padded = item.match(/^0?(\d{2,5})-/);
  if (padded) {
    const n = parseInt(padded[1], 10);
    if (n >= 1000) return String(Math.floor(n / 1000) * 1000);
    if (n >= 100) return String(Math.floor(n / 100) * 100).padStart(2, '0');
  }

  return parseDivisionCode(li.description);
}

/** Major CSI division header row (not sub-line headers like Flat Fee). */
function isMajorDivisionSection(li: BudgetSourceLine): boolean {
  if (!li.isSection) return false;
  if (String(li.itemNumber) !== String(li.sectionCode)) return false;

  const code = parseInt(String(li.sectionCode), 10);
  if (isNaN(code)) return classifyLineType(li.description) === 'Division';

  const desc = li.description.toUpperCase();
  if (code === 1000) return desc.includes('GENERAL CONDITIONS');
  if (code >= 2000) return true;
  return false;
}

function divisionLabel(code: string): string {
  const n = parseInt(code, 10);
  if (!isNaN(n) && n >= 1000) {
    const key = String(Math.floor(n / 1000)).padStart(2, '0');
    const name = CSI_DIVISION_NAMES[key];
    return name ? `DIV ${code} — ${name}` : `DIV ${code}`;
  }
  const name = CSI_DIVISION_NAMES[code.padStart(2, '0').slice(-2)];
  return name ? `DIV ${code} — ${name}` : `DIV ${code}`;
}

function findCpmMatch(
  description: string,
  subVendor: string | null | undefined,
  activities: CpmActivity[],
): CpmActivity | null {
  const descTokens = tokens(description);
  const subTokens = tokens(subVendor || '');
  if (descTokens.length === 0 && subTokens.length === 0) return null;

  let best: CpmActivity | null = null;
  let bestScore = 0;

  for (const a of activities) {
    const actTokens = tokens(a.activityName);
    const resTokens = tokens(a.resourceName || '');
    const wbsTokens = tokens(a.wbsCode || '');
    const pool = [...actTokens, ...resTokens, ...wbsTokens];

    let score = 0;
    for (const t of descTokens) {
      if (pool.some((p) => p === t || p.includes(t) || t.includes(p))) score += 3;
    }
    for (const t of subTokens) {
      if (resTokens.some((p) => p === t || p.includes(t))) score += 5;
      if (actTokens.some((p) => p.includes(t))) score += 2;
    }

    const dNorm = norm(description);
    const aNorm = norm(a.activityName);
    if (dNorm && aNorm && (aNorm.includes(dNorm) || dNorm.includes(aNorm))) score += 8;

    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }

  return bestScore >= 4 ? best : null;
}

function buildTradeRow(
  li: BudgetSourceLine,
  divisionCode: string | null,
  cpmActivities: CpmActivity[],
): GeneratedBuyoutRow {
  const desc = String(li.description || '').trim();
  const revised = revisedValue(li);
  const invested = investedToDate(li);
  const lineType = classifyLineType(desc);
  const cpm = findCpmMatch(desc, li.subVendor, cpmActivities);

  const row: GeneratedBuyoutRow = {
    sortOrder: 0,
    lineType,
    divisionCode,
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

  return row;
}

export function generateBuyoutFromBudgetLines(
  lines: BudgetSourceLine[],
  cpmActivities: CpmActivity[] = [],
): GeneratedBuyoutRow[] {
  const rows: GeneratedBuyoutRow[] = [];
  const divisionTotals = new Map<string, number>();
  let currentDivisionCode: string | null = null;
  let sawMajorSection = false;

  const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const li of sorted) {
    if (li.isFee || li.isBelowLine) continue;

    const desc = String(li.description || '').trim();
    if (!desc) continue;

    // Skip G703 sub-line section headers (Flat Fee, etc.) — trade row follows
    if (li.isSection && !isMajorDivisionSection(li)) continue;

    if (li.isSection && isMajorDivisionSection(li)) {
      sawMajorSection = true;
      currentDivisionCode = String(li.sectionCode || extractDivisionCode(li) || '');
      rows.push({
        sortOrder: rows.length + 1,
        lineType: 'Division',
        divisionCode: currentDivisionCode,
        trade: desc,
        status: 'Not Started',
        proposalAmount: 0,
        potentialBuyoutAmount: 0,
        contractedValue: 0,
        pendingCor: 0,
        changeOrders: (li.currentChanges || 0) + (li.previousChanges || 0),
        totalValueBudget: 0,
        totalByChapter: 0,
        cashFlowInvested: 0,
        subcontractor: null,
        dateSubOnSite: null,
        forecastContractDate: null,
        notes: 'Generated from budget / pay app',
      });
      continue;
    }

    const divCode: string | null = extractDivisionCode(li) ?? currentDivisionCode;
    if (divCode) currentDivisionCode = divCode;

    const row = buildTradeRow(li, divCode, cpmActivities);
    row.sortOrder = rows.length + 1;
    rows.push(row);

    if (divCode) {
      divisionTotals.set(divCode, (divisionTotals.get(divCode) || 0) + row.totalValueBudget);
    }
  }

  // No major division headers (e.g. Arena Madness PA) — insert synthetic DIV rows
  if (!sawMajorSection && divisionTotals.size > 0) {
    const trades = rows.filter((r) => r.lineType !== 'Division');
    rows.length = 0;
    let lastCode: string | null = null;

    for (const trade of trades) {
      const code = trade.divisionCode;
      if (code && code !== lastCode) {
        rows.push({
          sortOrder: rows.length + 1,
          lineType: 'Division',
          divisionCode: code,
          trade: divisionLabel(code),
          status: 'Not Started',
          proposalAmount: 0,
          potentialBuyoutAmount: 0,
          contractedValue: 0,
          pendingCor: 0,
          changeOrders: 0,
          totalValueBudget: 0,
          totalByChapter: divisionTotals.get(code) || 0,
          cashFlowInvested: 0,
          subcontractor: null,
          dateSubOnSite: null,
          forecastContractDate: null,
          notes: 'Generated from budget / pay app',
        });
        lastCode = code;
      }
      trade.sortOrder = rows.length + 1;
      rows.push(trade);
    }
  } else {
    // Set totalByChapter on major division rows
    for (const row of rows) {
      if (row.lineType === 'Division' && row.divisionCode) {
        row.totalByChapter = divisionTotals.get(row.divisionCode) || 0;
      }
    }
  }

  return rows;
}
