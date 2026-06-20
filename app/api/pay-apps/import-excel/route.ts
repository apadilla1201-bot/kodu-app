export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import * as XLSX from 'xlsx';

function num(v: any): number {
  if (v == null || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  // Only parse as number if it looks like a pure number (with optional $ , . ( ) - )
  const s = String(v).trim();
  // Reject strings that start with letters or are clearly labels like "7.  LESS PREVIOUS..."
  if (/^\d+\.\s+[A-Za-z]/.test(s)) return 0;
  const cleaned = s.replace(/[,$\s]/g, '');
  // Handle parenthesized negative numbers: (1234.56) -> -1234.56
  const parenMatch = cleaned.match(/^\(([\d.]+)\)$/);
  if (parenMatch) return -parseFloat(parenMatch[1]);
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
/** numStrict - only parse actual numbers or pure numeric strings */
function numStrict(v: any): number {
  if (v == null || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,$\s]/g, '').trim();
  // Must be purely numeric (with optional decimal, sign, or parens)
  if (/^-?[\d.]+$/.test(s)) return parseFloat(s);
  const parenMatch = s.match(/^\(([\d.]+)\)$/);
  if (parenMatch) return -parseFloat(parenMatch[1]);
  return 0;
}
function str(v: any): string { return v == null ? '' : String(v).trim(); }

/** Find the next non-empty cell value after column j */
function nextVal(row: any[], j: number): any {
  for (let k = j + 1; k < Math.min(j + 4, row.length); k++) {
    if (row[k] != null && row[k] !== '') return row[k];
  }
  return null;
}

/** Parse a date value that can be a Date object, Excel serial, or string like "05/30/2026" */
function parseDate(v: any): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  if (typeof v === 'number' && v > 30000 && v < 70000) {
    // Excel serial date
    const d = new Date((v - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  // Try MM/DD/YYYY or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(parseInt(mdy[3]), parseInt(mdy[1]) - 1, parseInt(mdy[2]));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // Try YYYY-MM-DD
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // Last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    console.log('PA Excel sheets:', wb.SheetNames);

    const headerData: any = {};
    const lineItems: any[] = [];

    // ===== PROJECT SETTINGS =====
    const settingsName = wb.SheetNames.find(n => /project.*setting|settings/i.test(n));
    if (settingsName) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[settingsName], { header: 1, defval: '' });
      for (const row of rows) {
        // Labels in col B (index 1), values in col C (index 2)
        const label = str(row[1]).toUpperCase();
        const val = row[2];
        if (!label) continue;

        if (label.includes('PROJECT NAME')) headerData.projectName = str(val);
        if (label.includes('GC COMPANY')) headerData.gcCompany = str(val);
        if (label.includes('OWNER NAME')) headerData.ownerName = str(val);
        if (label.includes('CONTRACT FORM')) headerData.contractForm = str(val);
        if (label.includes('PROJECT NO')) headerData.projectNumber = str(val);
        if (label.includes('CONSTRUCTION SUBTOTAL')) headerData.constructionSubtotal = num(val);
        if (label.includes('ORIGINAL CONTRACT SUM')) headerData.originalContractSum = num(val);
        if (label.includes('OVERHEAD') && label.includes('%')) { const p = num(val); if (p > 0) headerData.opPercent = p > 1 ? p / 100 : p; }
        if ((label.includes('GENERAL LIABILITY') || label.includes('GL')) && label.includes('%')) { const p = num(val); if (p > 0) headerData.glPercent = p > 1 ? p / 100 : p; }
        if (label.includes('CONTINGENCY') && label.includes('%')) { const p = num(val); if (p > 0) headerData.contingencyPercent = p > 1 ? p / 100 : p; }
        if (label.includes('RETAINAGE') && label.includes('%') && !label.includes('CONTINGENCY')) { const p = num(val); if (p > 0) headerData.retainagePercent = p > 1 ? p / 100 : p; }
        if (label.includes('RETAINAGE') && label.includes('CONTINGENCY')) { const p = num(val); headerData.retainageContPercent = p > 1 ? p / 100 : p; }
        if (label.includes('OVERHEAD') && label.includes('AMOUNT')) headerData.opAmount = num(val);
        if (label.includes('GL INSURANCE AMOUNT') || (label.includes('GL') && label.includes('AMOUNT'))) headerData.glInsuranceAmount = num(val);
        if (label.includes('CONTINGENCY AMOUNT')) headerData.contingencyAmount = num(val);
        if (label.includes('PAY APPLICATION NUMBER') || label.includes('APPLICATION #')) headerData.applicationNumber = Math.round(num(val));
        if (label.includes('APPLICATION DATE')) {
          const d = parseDate(val);
          if (d) headerData.applicationDate = d;
        }
        if (label.includes('PERIOD FROM')) {
          const d = parseDate(val);
          if (d) headerData.periodFrom = d;
        }
        if (label.includes('PERIOD TO')) {
          const d = parseDate(val);
          if (d) headerData.periodTo = d;
        }
      }
    }

    // ===== G702 =====
    const g702Name = wb.SheetNames.find(n => /g702|g-702/i.test(n));
    if (g702Name) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[g702Name], { header: 1, defval: '' });
      for (const row of rows) {
        // Search all cells for labels, values may be offset
        const joined = row.map((c: any) => str(c).toUpperCase()).join('|');
        
        // Application info from header area
        if (joined.includes('TO OWNER')) {
          // Owner on next row typically col B
        }
        if (joined.includes('APPLICATION NO')) {
          for (let j = 0; j < row.length; j++) {
            if (str(row[j]).toUpperCase().includes('APPLICATION NO')) {
              const v = num(nextVal(row, j));
              if (v > 0) headerData.applicationNumber = Math.round(v);
            }
          }
        }
        if (joined.includes('APPLICATION DATE')) {
          for (let j = 0; j < row.length; j++) {
            if (str(row[j]).toUpperCase().includes('APPLICATION DATE')) {
              const v = nextVal(row, j);
              const d = parseDate(v);
              if (d) headerData.applicationDate = d;
            }
          }
        }
        if (joined.includes('PERIOD TO')) {
          for (let j = 0; j < row.length; j++) {
            if (str(row[j]).toUpperCase().includes('PERIOD TO')) {
              const v = nextVal(row, j);
              const d = parseDate(v);
              if (d) headerData.periodTo = d;
            }
          }
        }
        if (joined.includes('PERIOD FROM')) {
          for (let j = 0; j < row.length; j++) {
            if (str(row[j]).toUpperCase().includes('PERIOD FROM')) {
              const v = nextVal(row, j);
              const d = parseDate(v);
              if (d) headerData.periodFrom = d;
            }
          }
        }
        if (joined.includes('CONTRACT DATE')) {
          for (let j = 0; j < row.length; j++) {
            if (str(row[j]).toUpperCase().includes('CONTRACT DATE')) {
              const v = nextVal(row, j);
              const d = parseDate(v);
              if (d) headerData.contractDate = d;
            }
          }
        }
        if (joined.includes('CONTRACT FOR')) {
          for (let j = 0; j < row.length; j++) {
            if (str(row[j]).toUpperCase().includes('CONTRACT FOR')) {
              headerData.contractFor = str(row[j + 1] || '');
            }
          }
        }

        // Retainage percentage from G702 (e.g. row: "a. | 5 | % of Completed Work | $ | 119542...")
        if (joined.includes('% OF COMPLETED WORK') || joined.includes('% OF STORED MATERIAL')) {
          // The percentage is typically a standalone number cell (e.g. 5 or 10)
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]);
            if (v > 0 && v <= 100) {
              headerData.retainagePercent = v > 1 ? v / 100 : v;
              break;
            }
          }
        }

        // Financial lines - capture G702 fixed values
        if (joined.includes('ORIGINAL CONTRACT SUM')) {
          for (let j = 0; j < row.length; j++) {
            const v = num(row[j]); if (v > 100000) { headerData.originalContractSum = v; break; }
          }
        }
        if (joined.includes('NET CHANGE') && joined.includes('CHANGE ORDER')) {
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]); if (v !== 0) { headerData.g702NetChange = v; break; }
          }
        }
        if (joined.includes('CONTRACT SUM TO DATE') || (joined.includes('LINE 1') && joined.includes('2'))) {
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]); if (v > 100000) { headerData.g702ContractSumToDate = v; break; }
          }
        }
        if (joined.includes('TOTAL COMPLETED') && joined.includes('STORED')) {
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]); if (v > 1000) { headerData.g702TotalCompleted = v; break; }
          }
        }
        if (joined.includes('TOTAL EARNED LESS RETAINAGE') || (joined.includes('LINE 4') && joined.includes('LINE 5'))) {
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]); if (v > 1000) { headerData.g702TotalEarned = v; break; }
          }
        }
        if (joined.includes('CURRENT PAYMENT DUE')) {
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]); if (v !== 0) { headerData.g702CurrentPaymentDue = v; break; }
          }
        }
        if (joined.includes('BALANCE TO FINISH')) {
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]); if (v > 1000) { headerData.g702BalanceToFinish = v; break; }
          }
        }
        // Retainage total (line 5)
        if (joined.includes('TOTAL RETAINAGE') || (joined.includes('LINES 5A') && joined.includes('5B'))) {
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]); if (v > 0) { headerData.g702Retainage = v; break; }
          }
        }
        if (joined.includes('ADVANCE PAYMENT') || joined.includes('7A')) {
          // Use numStrict to avoid parsing '7a.' label as number 7
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]); if (v > 0) { headerData.advancePayments = v; break; }
          }
          // Also capture label
          const c0 = str(row[0]); if (c0.length > 10) headerData.advancePaymentsLabel = c0;
        }
        if (joined.includes('DIRECT PAYMENT') || joined.includes('7B')) {
          // Collect all numeric values in this row
          const vals: number[] = [];
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]);
            if (v > 0) vals.push(v);
          }
          if (vals.length >= 2) {
            // First large value is total direct payments, second is the deduction for this period
            vals.sort((a, b) => b - a);
            headerData.directPayments = vals[0]; // total info
            headerData.directPaymentsDeduction = vals[vals.length - 1]; // smallest = period deduction
          } else if (vals.length === 1) {
            headerData.directPayments = vals[0];
          }
          const c0 = str(row[0]); if (c0.length > 10) headerData.directPaymentsLabel = c0;
        }
        if (joined.includes('PREVIOUS CERT') || (joined.includes('LESS PREVIOUS') && joined.includes('PAYMENT'))) {
          // Find the large dollar amount in this row — skip labels like "7. LESS..." that parse as small numbers
          let best = 0;
          for (let j = 0; j < row.length; j++) {
            const v = numStrict(row[j]);
            if (v > best) best = v;
          }
          if (best > 0) headerData.previousCertificates = best;
        }
        // Owner/contractor names from signature area
        if (joined.includes('PRINTED')) {
          for (let j = 0; j < row.length; j++) {
            if (str(row[j]).toUpperCase().includes('PRINTED')) {
              const name = str(row[j + 1]);
              if (name && !headerData.contractorPrinted) headerData.contractorPrinted = name;
              else if (name) headerData.ownerPrinted = name;
            }
          }
        }
      }

      // Extract owner/architect info and addresses from header area
      const rows2 = rows;
      for (let i = 0; i < Math.min(20, rows2.length); i++) {
        const row = rows2[i];
        const prev = i > 0 ? rows2[i - 1] : null;
        const joined_i = row.map((c: any) => str(c).toUpperCase()).join('|');
        // Owner name typically follows "TO OWNER:" label
        if (prev && str(prev[0]).toUpperCase().includes('TO OWNER')) {
          if (str(row[1])) headerData.ownerName = headerData.ownerName || str(row[1]);
          // Address on next rows (B8, B9)
          const next1 = i + 1 < rows2.length ? rows2[i + 1] : null;
          const next2 = i + 2 < rows2.length ? rows2[i + 2] : null;
          if (next1 && str(next1[1])) headerData.ownerAddress = str(next1[1]);
          if (next2 && str(next2[1])) headerData.ownerCity = str(next2[1]);
        }
        if (prev && str(prev[0]).toUpperCase().includes('FROM CONTRACTOR')) {
          if (str(row[1])) headerData.gcCompany = headerData.gcCompany || str(row[1]);
        }
        if (prev && (str(prev[3]).toUpperCase().includes('ARCHITECT') || str(prev[3]).toUpperCase().includes('PROJECT'))) {
          if (str(row[4])) headerData.architectName = headerData.architectName || str(row[4]);
          // Architect address on next rows (E12, E13)
          const next1 = i + 1 < rows2.length ? rows2[i + 1] : null;
          const next2 = i + 2 < rows2.length ? rows2[i + 2] : null;
          if (next1 && str(next1[4])) headerData.architectAddress = str(next1[4]);
          if (next2 && str(next2[4])) headerData.architectCity = str(next2[4]);
        }
        // PROJECT NO from G702 header
        if (joined_i.includes('PROJECT NO')) {
          for (let j = 0; j < row.length; j++) {
            if (str(row[j]).toUpperCase().includes('PROJECT NO')) {
              const v = str(nextVal(row, j));
              if (v) headerData.projectNumber = headerData.projectNumber || v;
            }
          }
        }
      }
    }

    // ===== G703 (Line Items) =====
    const g703Name = wb.SheetNames.find(n => /g703|g-703|continuation/i.test(n));
    if (g703Name) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[g703Name], { header: 1, defval: '' });

      // Find header row by looking for ITEM + DESCRIPTION
      let headerRow = -1;
      const colIdx: Record<string, number> = {};

      for (let i = 0; i < Math.min(15, rows.length); i++) {
        const row = rows[i];
        if (!row) continue;
        const ups = row.map((c: any) => str(c).toUpperCase().replace(/\n/g, ' '));
        const hasItem = ups.some(h => /\bITEM\b/.test(h));
        const hasDesc = ups.some(h => /DESCRIPTION/.test(h));
        if (hasItem && hasDesc) {
          headerRow = i;
          for (let j = 0; j < ups.length; j++) {
            const h = ups[j];
            if (/\bITEM\b/.test(h)) colIdx.item = j;
            else if (/DESCRIPTION/.test(h)) colIdx.desc = j;
            else if (/SUB|VENDOR/.test(h)) colIdx.sub = j;
            else if (/SCHEDULED|ORIGINAL/.test(h)) colIdx.sched = j;
            else if (/BUDGET|REALLOC/.test(h)) colIdx.realloc = j;
            else if (/PREV.*CHANGE/.test(h)) colIdx.prevCh = j;
            else if (/CURRENT.*CHANGE|CURR.*CH/.test(h)) colIdx.currCh = j;
            else if (/REVISED/.test(h)) colIdx.revised = j;
            else if (/PREV.*PERIOD|PREV.*COMPL/.test(h)) colIdx.prevComp = j;
            else if (/THIS.*PERIOD|THIS.*COMPL/.test(h)) colIdx.thisComp = j;
            else if (/TOTAL.*COMPL/.test(h)) colIdx.totalComp = j;
            else if (/BALANCE/.test(h)) colIdx.balance = j;
            else if (/RETAINAGE|\bRET\b/.test(h)) colIdx.ret = j;
          }
          break;
        }
      }

      console.log('G703 header row:', headerRow, 'columns:', colIdx);

      if (headerRow >= 0) {
        let sortOrder = 0;
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const c0 = str(row[colIdx.item ?? 0]);
          const c1 = str(row[colIdx.desc ?? 1]);
          if (!c0 && !c1) continue;
          const descUp = c1.toUpperCase();

          // Skip grand total and powered-by footer
          if (descUp.includes('GRAND TOTAL') || descUp.includes('POWERED BY')) continue;

          const sv = num(row[colIdx.sched ?? 3]);
          const sub = str(row[colIdx.sub ?? 2]);

          // Section header: division code (5 digits) + ALL CAPS description, no sub, no scheduled value
          const isSection = /^\d{5}$/.test(c0) && c1 === c1.toUpperCase() && c1.length > 3 && !sv;
          // Subtotal row
          const isSubtotal = /subtotal/i.test(c1);
          // Below the line
          const isBelowLine = /below.*line|pass.*through/i.test(c0 + c1) && !isSubtotal;
          // Fee
          const isFee = /^(O&P|GLI|CONT)$/.test(c0) ||
            (/overhead.*profit/i.test(c1) && !isSection) ||
            (/liability.*insurance/i.test(c1) && !isSection) ||
            (/contingency/i.test(c1) && !isSection && !isSubtotal);
          // Total rows (not grand)
          const isTotalRow = /^\s*TOTAL\b/i.test(c1) && !descUp.includes('GRAND');

          // Skip subtotal and total rows for PA line items
          if (isSubtotal || isTotalRow) continue;

          sortOrder++;
          let sectionCode = '';
          if (isFee) {
            if (/overhead|O&P/i.test(c0 + c1)) sectionCode = 'O&P';
            else if (/liability|GLI/i.test(c0 + c1)) sectionCode = 'GLI';
            else if (/contingency|CONT/i.test(c0 + c1)) sectionCode = 'CONT';
          } else {
            const dm = c0.match(/^(\d{5})/);
            if (dm) sectionCode = dm[1];
          }

          lineItems.push({
            sortOrder,
            itemNumber: c0,
            description: c1,
            subVendor: sub,
            scheduledValue: sv,
            budgetRealloc: num(row[colIdx.realloc ?? 4]),
            previousChanges: num(row[colIdx.prevCh ?? 5]),
            currentChanges: num(row[colIdx.currCh ?? 6]),
            previousCompleted: num(row[colIdx.prevComp ?? 8]),
            thisCompleted: num(row[colIdx.thisComp ?? 9]),
            retainage: num(row[colIdx.ret ?? 13]),
            isSection,
            isBelowLine: isBelowLine || /^PA-/i.test(c0),
            isFee,
            sectionCode,
            sectionTitle: isSection ? c1 : '',
          });
        }
      }
    }

    console.log('PA Excel: lines:', lineItems.length, 'header keys:', Object.keys(headerData));
    console.log('PA Excel dates: appDate=', headerData.applicationDate, 'periodFrom=', headerData.periodFrom, 'periodTo=', headerData.periodTo, 'appNum=', headerData.applicationNumber);

    return NextResponse.json({
      success: true,
      headerData,
      lineItems,
      sheetsFound: { g703: !!g703Name, g702: !!g702Name, settings: !!settingsName },
    });
  } catch (error: any) {
    console.error('PA Excel import error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to parse Excel file' }, { status: 500 });
  }
}
