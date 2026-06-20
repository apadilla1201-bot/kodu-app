export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import * as XLSX from 'xlsx';

function num(v: any): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$]/g, ''));
  return isNaN(n) ? 0 : n;
}
function str(v: any): string { return v == null ? '' : String(v).trim(); }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });

    const result: any = { lineItems: [], detailItems: [], summary: {}, exclusions: '', assumptions: '' };

    // ===== SUMMARY SHEET =====
    const summarySheet = wb.SheetNames.find(n => /summary/i.test(n));
    if (summarySheet) {
      const ws = wb.Sheets[summarySheet];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // Parse header info
      result.summary.projectTitle = str(rows[0]?.[0] || '');
      result.summary.company = str(rows[1]?.[0] || '');
      result.summary.owner = str(rows[2]?.[0] || '');
      const dateRow = rows.find(r => /date/i.test(str(r[0])));
      if (dateRow) result.summary.budgetDate = str(dateRow[1]);
      const sfRow = rows.find(r => /total.*ac.*sf/i.test(str(r[3] || r[0])));
      if (sfRow) result.summary.totalACSF = num(sfRow[4] || sfRow[1]);
      const sfRateRow = rows.find(r => /sf rate/i.test(str(r[3] || r[0])));
      if (sfRateRow) result.summary.sfRate = num(sfRateRow[4] || sfRateRow[1]);

      // Parse division rows - look for rows with division code in C1 and bid value in C4/C5
      const divisions: any[] = [];
      let constructionSubtotal = 0, furnishingsSubtotal = 0, subTotalAll = 0;
      let opPercent = 0.08, glPercent = 0.02, contingencyPercent = 0.10;
      let opAmount = 0, glAmount = 0, contingencyAmount = 0, grandTotal = 0;

      for (let i = 7; i < rows.length; i++) {
        const r = rows[i];
        const c0 = str(r[0]); const c1 = str(r[1]); const c2 = str(r[2]); const c3 = str(r[3]);
        const val = num(r[3]);

        if (/construction.*sub\s*total/i.test(c2 || c1)) { constructionSubtotal = val; continue; }
        if (/furnishings/i.test(c1) && /sub\s*total/i.test(c2)) { furnishingsSubtotal = val; continue; }
        if (/sub\s*total\s*all/i.test(c1 + c2)) { subTotalAll = val; continue; }
        if (/general.*liability/i.test(c1)) { glAmount = val; const pct = num(r[4]); if (pct > 0 && pct < 1) glPercent = pct; continue; }
        if (/contingency/i.test(c1)) { contingencyAmount = val; continue; }
        if (c0 && /^\d{5}$/.test(c0) && c1) {
          divisions.push({ divisionCode: c0, description: c1, bidValue: val, bidPercent: num(r[4]) });
        }
        // O&P row - usually has 0 in C2 and 8% value in C3
        if (i > 50 && val > 100000 && !c1 && num(r[4]) > 0.05 && num(r[4]) < 0.12) {
          opAmount = val; opPercent = num(r[4]);
        }
      }

      // Find grand total row
      for (let i = rows.length - 1; i >= 0; i--) {
        const v = num(rows[i]?.[3]);
        if (v > subTotalAll && v > 1000000) { grandTotal = v; break; }
      }

      result.summary.constructionSubtotal = constructionSubtotal;
      result.summary.furnishingsSubtotal = furnishingsSubtotal;
      result.summary.subTotalAll = subTotalAll;
      result.summary.opPercent = opPercent;
      result.summary.glPercent = glPercent;
      result.summary.contingencyPercent = contingencyPercent;
      result.summary.opAmount = opAmount;
      result.summary.glAmount = glAmount;
      result.summary.contingencyAmount = contingencyAmount;
      result.summary.grandTotal = grandTotal;
      result.summary.divisions = divisions;
    }

    // ===== TAKE OFF SHEET =====
    const takeOffSheet = wb.SheetNames.find(n => /take\s*off/i.test(n));
    if (takeOffSheet) {
      const ws = wb.Sheets[takeOffSheet];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // Find header row
      let headerRow = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const r = rows[i];
        if (r.some((c: any) => /ITEM.*NO/i.test(str(c))) && r.some((c: any) => /DESCRIPTION/i.test(str(c)))) {
          headerRow = i; break;
        }
      }
      if (headerRow === -1) headerRow = 4; // default

      let sortOrder = 0;
      let currentDivCode = '';
      for (let i = headerRow + 1; i < rows.length; i++) {
        const r = rows[i];
        const c0 = str(r[0]); const c1 = str(r[1]); const c2 = str(r[2]);
        const c3 = num(r[3]); const c4 = num(r[4]); const c5 = num(r[5]); const c6 = num(r[6]);

        if (!c0 && !c1) continue;

        // Section header: division code + ALL CAPS description, no sub/vendor, no scheduled value
        const isSectionHeader = c0 && /^\d{5}\s+·/.test(c0) && !c1;
        // Subtotal row
        const isSubtotal = /subtotal/i.test(c0);
        // Below the line
        const isBelowLine = /below\s*the\s*line/i.test(c0 + c1);
        // Fee rows
        const isFee = /^(O&P|GLI|CONT)$/.test(c0) || /overhead.*profit|liability.*insurance|contingency/i.test(c0 + c1);
        // Grand total
        const isGrandTotal = /grand\s*total/i.test(c0 + c1);
        // Total row
        const isTotalRow = /^\s*TOTAL\b/i.test(c1) && !isGrandTotal;

        if (isSectionHeader) {
          const match = c0.match(/^(\d{5})/);
          currentDivCode = match ? match[1] : '';
          const title = c0.replace(/^\d{5}\s*·\s*/, '').trim();
          result.lineItems.push({
            sortOrder: sortOrder++, divisionCode: currentDivCode, itemNumber: '',
            description: title, subVendor: '', scheduledValue: 0, currentChanges: 0,
            revisedValue: 0, percentTotal: 0, isSection: true, isSubtotal: false, isFee: false, isBelowLine: false,
          });
        } else if (isSubtotal) {
          result.lineItems.push({
            sortOrder: sortOrder++, divisionCode: currentDivCode, itemNumber: '',
            description: c0, subVendor: '', scheduledValue: c3, currentChanges: c4,
            revisedValue: c5, percentTotal: 0, isSection: false, isSubtotal: true, isFee: false, isBelowLine: false,
          });
        } else if (isBelowLine && !isSubtotal) {
          result.lineItems.push({
            sortOrder: sortOrder++, divisionCode: '', itemNumber: '',
            description: c0 || c1, subVendor: '', scheduledValue: 0, currentChanges: 0,
            revisedValue: 0, percentTotal: 0, isSection: true, isSubtotal: false, isFee: false, isBelowLine: true,
          });
        } else if (isFee) {
          result.lineItems.push({
            sortOrder: sortOrder++, divisionCode: '', itemNumber: c0,
            description: c1, subVendor: c2, scheduledValue: c3, currentChanges: c4,
            revisedValue: c5, percentTotal: c6, isSection: false, isSubtotal: false, isFee: true, isBelowLine: false,
          });
        } else if (isTotalRow || isGrandTotal) {
          result.lineItems.push({
            sortOrder: sortOrder++, divisionCode: '', itemNumber: '',
            description: c1 || c0, subVendor: '', scheduledValue: c3, currentChanges: c4,
            revisedValue: c5, percentTotal: 0, isSection: false, isSubtotal: true, isFee: false, isBelowLine: false,
          });
        } else if (c0 && c0.includes('-')) {
          // Regular line item
          const divMatch = c0.match(/^(\d{5})/);
          if (divMatch) currentDivCode = divMatch[1];
          result.lineItems.push({
            sortOrder: sortOrder++, divisionCode: currentDivCode, itemNumber: c0,
            description: c1, subVendor: c2, scheduledValue: c3, currentChanges: c4,
            revisedValue: c5, percentTotal: c6, isSection: false, isSubtotal: false, isFee: false,
            isBelowLine: /^PA-/i.test(c0),
          });
        }
      }
    }

    // ===== GCs & PROJECT SUPPORT SHEETS =====
    for (const sheetName of ['GCs', 'Project Support']) {
      const sn = wb.SheetNames.find(n => {
        if (sheetName === 'GCs') return /^gc/i.test(n.trim());
        return /project.*support/i.test(n);
      });
      if (!sn) continue;
      const ws = wb.Sheets[sn];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Find header row with Item Code, Description, etc.
      let headerRow = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (rows[i].some((c: any) => /item.*code/i.test(str(c))) && rows[i].some((c: any) => /description/i.test(str(c)))) {
          headerRow = i; break;
        }
      }
      if (headerRow === -1) headerRow = 4;

      let sortOrder = 0;
      for (let i = headerRow + 1; i < rows.length; i++) {
        const r = rows[i];
        const c0 = str(r[0]); // status column (excluded, cost of work, etc)
        const c1 = str(r[1]); // item code
        const c2 = str(r[2]); // description
        if (!c2) continue;
        // Skip total rows
        if (/^total/i.test(c2)) continue;
        // Check if header row (no item code, description is a category)
        const isHeader = !c1 && c2 && !num(r[14]);

        result.detailItems.push({
          sheetName,
          sortOrder: sortOrder++,
          status: c0.toLowerCase(),
          itemCode: c1,
          description: c2,
          quantity: num(r[3]),
          unit: str(r[4]),
          laborUnit: num(r[5]),
          laborTotal: num(r[6]),
          materialUnit: num(r[7]),
          materialTotal: num(r[8]),
          equipmentUnit: num(r[9]),
          equipmentTotal: num(r[10]),
          subUnit: num(r[11]),
          subTotal: num(r[12]),
          totalUnitCost: num(r[13]),
          totalCost: num(r[14]),
          isHeader,
        });
      }
    }

    // ===== EXCLUSIONS & QUALIFICATIONS =====
    const exclSheet = wb.SheetNames.find(n => /excl/i.test(n));
    if (exclSheet) {
      const ws = wb.Sheets[exclSheet];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let section = '';
      const exclusionLines: string[] = [];
      const assumptionLines: string[] = [];
      for (const r of rows) {
        const text = str(r[0]);
        if (!text) continue;
        if (/project\s*exclusions/i.test(text)) { section = 'exclusions'; continue; }
        if (/project\s*assumptions/i.test(text)) { section = 'assumptions'; continue; }
        if (section === 'exclusions') exclusionLines.push(text);
        else if (section === 'assumptions') assumptionLines.push(text);
      }
      result.exclusions = exclusionLines.join('\n');
      result.assumptions = assumptionLines.join('\n');
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Budget Excel import error:', error);
    return NextResponse.json({ error: error.message || 'Failed to parse budget Excel' }, { status: 500 });
  }
}
