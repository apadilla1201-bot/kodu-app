import * as XLSX from 'xlsx';
import {
  classifyLineType,
  computeBudget,
  inferStatus,
  parseDivisionCode,
  toDateOrNull,
} from '@/lib/buyout';

export interface ParsedBuyoutRow {
  sortOrder: number;
  lineType: string;
  divisionCode: string | null;
  trade: string;
  status: string;
  proposalAmount: number;
  proposalDetails: string | null;
  potentialBuyoutAmount: number;
  potentialBuyoutDetails: string | null;
  contractedValue: number;
  pendingCor: number;
  changeOrders: number;
  totalValueBudget: number;
  totalByChapter: number | null;
  cashFlowInvested: number;
  targetContractDate: Date | null;
  actualContractDate: Date | null;
  dateSubOnSite: Date | null;
  productLeadTimeDays: number | null;
  approvalLeadTimeDays: number | null;
  finalOwnerApprovalDate: Date | null;
  finalSubmissionApprovalDate: Date | null;
  forecastBidDate: Date | null;
  forecastContractDate: Date | null;
  awardDate: Date | null;
  subcontractor: string | null;
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && !isNaN(v)) return v;
  const n = parseFloat(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : n;
}

function intOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

function strOrNull(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

function excelDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return toDateOrNull(v);
  if (typeof v === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const date = new Date(d.y, d.m - 1, d.d);
    return toDateOrNull(date);
  }
  const parsed = new Date(String(v));
  return toDateOrNull(parsed);
}

/** Parse Arena Madness Contract Tracking workbook (or compatible layout). */
export function parseBuyoutWorkbook(buffer: Buffer | ArrayBuffer): ParsedBuyoutRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames.find((n) => /contract|buyout|tracking/i.test(n)) ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  // Find header row (contains "Trade")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cell = rows[i]?.[0];
    if (cell && String(cell).trim().toLowerCase() === 'trade') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 4; // Arena Madness default

  const items: ParsedBuyoutRow[] = [];
  let currentDivision: string | null = null;
  let sortOrder = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const trade = String(r[0]).trim();
    if (!trade) continue;
    if (/^arena madness/i.test(trade)) continue;
    if (/grand total|total project/i.test(trade)) continue;

    const lineType = classifyLineType(trade);
    if (lineType === 'Division') {
      currentDivision = parseDivisionCode(trade) ?? trade;
    }

    const proposalAmount = num(r[5]);
    const potentialBuyoutAmount = num(r[7]);
    const contractedValue = num(r[8]);
    const pendingCor = num(r[9]);
    const changeOrders = num(r[10]);
    const totalValueBudget =
      num(r[11]) ||
      computeBudget({
        contractedValue,
        pendingCor,
        changeOrders,
        proposalAmount,
        potentialBuyoutAmount,
      });
    const totalByChapter = r[12] != null && r[12] !== '' ? num(r[12]) : null;
    const cashFlowInvested = num(r[14]);
    const subcontractor = strOrNull(r[24]);
    const awardDate = excelDate(r[25]);
    const dateSubOnSite = excelDate(r[17]);
    const finalOwnerApprovalDate = excelDate(r[20]);

    const status = inferStatus({
      subcontractor,
      awardDate,
      contractedValue,
      dateSubOnSite,
      finalOwnerApprovalDate,
      lineType,
    });

    items.push({
      sortOrder: sortOrder++,
      lineType,
      divisionCode: lineType === 'Division' ? currentDivision : currentDivision,
      trade,
      status,
      proposalAmount,
      proposalDetails: strOrNull(r[4]),
      potentialBuyoutAmount,
      potentialBuyoutDetails: strOrNull(r[6]),
      contractedValue,
      pendingCor,
      changeOrders,
      totalValueBudget,
      totalByChapter,
      cashFlowInvested,
      targetContractDate: excelDate(r[1]),
      actualContractDate: excelDate(r[2]),
      dateSubOnSite,
      productLeadTimeDays: intOrNull(r[18]),
      approvalLeadTimeDays: intOrNull(r[19]),
      finalOwnerApprovalDate,
      finalSubmissionApprovalDate: excelDate(r[21]),
      forecastBidDate: excelDate(r[22]),
      forecastContractDate: excelDate(r[23]),
      awardDate,
      subcontractor,
    });
  }

  return items;
}
