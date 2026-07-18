export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

function num(v: any): number {
  if (v == null || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (/^\d+\.\s+[A-Za-z]/.test(s)) return 0;
  const cleaned = s.replace(/[,$\s]/g, '');
  const parenMatch = cleaned.match(/^\(([\d.]+)\)$/);
  if (parenMatch) return -parseFloat(parenMatch[1]);
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
function numStrict(v: any): number {
  if (v == null || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,$\s]/g, '').trim();
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
function parseDateVal(v: any): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  if (typeof v === 'number' && v > 30000 && v < 70000) {
    const d = new Date((v - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(parseInt(mdy[3]), parseInt(mdy[1]) - 1, parseInt(mdy[2]));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

interface ParsedPA {
  fileName: string;
  headerData: Record<string, any>;
  lineItems: any[];
  sheetsFound: { g703: boolean; g702: boolean; settings: boolean };
}

function parseExcelBuffer(buffer: Buffer, fileName: string): ParsedPA {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const headerData: any = {};
  const lineItems: any[] = [];

  // ===== PROJECT SETTINGS =====
  const settingsName = wb.SheetNames.find(n => /project.*setting|settings/i.test(n));
  if (settingsName) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[settingsName], { header: 1, defval: '' });
    for (const row of rows) {
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
        const d = parseDateVal(val);
        if (d) headerData.applicationDate = d;
      }
      if (label.includes('PERIOD FROM')) {
        const d = parseDateVal(val);
        if (d) headerData.periodFrom = d;
      }
      if (label.includes('PERIOD TO')) {
        const d = parseDateVal(val);
        if (d) headerData.periodTo = d;
      }
    }
  }

  // ===== G702 =====
  const g702Name = wb.SheetNames.find(n => /g702|g-702/i.test(n));
  if (g702Name) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[g702Name], { header: 1, defval: '' });
    for (const row of rows) {
      const joined = row.map((c: any) => str(c).toUpperCase()).join('|');
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
            const d = parseDateVal(nextVal(row, j));
            if (d) headerData.applicationDate = d;
          }
        }
      }
      if (joined.includes('PERIOD TO')) {
        for (let j = 0; j < row.length; j++) {
          if (str(row[j]).toUpperCase().includes('PERIOD TO')) {
            const d = parseDateVal(nextVal(row, j));
            if (d) headerData.periodTo = d;
          }
        }
      }
      if (joined.includes('PERIOD FROM')) {
        for (let j = 0; j < row.length; j++) {
          if (str(row[j]).toUpperCase().includes('PERIOD FROM')) {
            const d = parseDateVal(nextVal(row, j));
            if (d) headerData.periodFrom = d;
          }
        }
      }
      if (joined.includes('ORIGINAL CONTRACT SUM')) {
        for (let j = 0; j < row.length; j++) {
          const v = num(row[j]); if (v > 100000) { headerData.originalContractSum = v; break; }
        }
      }
      // G702 fixed values
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
      if (joined.includes('TOTAL RETAINAGE') || (joined.includes('LINES 5A') && joined.includes('5B'))) {
        for (let j = 0; j < row.length; j++) {
          const v = numStrict(row[j]); if (v > 0) { headerData.g702Retainage = v; break; }
        }
      }
      // Retainage percentage
      if (joined.includes('% OF COMPLETED WORK') || joined.includes('% OF STORED MATERIAL')) {
        for (let j = 0; j < row.length; j++) {
          const v = numStrict(row[j]);
          if (v > 0 && v <= 100) { headerData.retainagePercent = v > 1 ? v / 100 : v; break; }
        }
      }
      // Advance payments
      if (joined.includes('ADVANCE PAYMENT') || joined.includes('7A')) {
        for (let j = 0; j < row.length; j++) {
          const v = numStrict(row[j]); if (v > 0) { headerData.advancePayments = v; break; }
        }
        const c0 = str(row[0]); if (c0.length > 10) headerData.advancePaymentsLabel = c0;
      }
      // Direct payments
      if (joined.includes('DIRECT PAYMENT') || joined.includes('7B')) {
        const vals: number[] = [];
        for (let j = 0; j < row.length; j++) {
          const v = numStrict(row[j]); if (v > 0) vals.push(v);
        }
        if (vals.length >= 2) {
          vals.sort((a, b) => b - a);
          headerData.directPayments = vals[0];
          headerData.directPaymentsDeduction = vals[vals.length - 1];
        } else if (vals.length === 1) {
          headerData.directPayments = vals[0];
        }
        const c0 = str(row[0]); if (c0.length > 10) headerData.directPaymentsLabel = c0;
      }
      // Previous certificates
      if (joined.includes('PREVIOUS CERT') || (joined.includes('LESS PREVIOUS') && joined.includes('PAYMENT'))) {
        let best = 0;
        for (let j = 0; j < row.length; j++) {
          const v = numStrict(row[j]); if (v > best) best = v;
        }
        if (best > 0) headerData.previousCertificates = best;
      }
      // Contract date
      if (joined.includes('CONTRACT DATE')) {
        for (let j = 0; j < row.length; j++) {
          if (str(row[j]).toUpperCase().includes('CONTRACT DATE')) {
            const d = parseDateVal(nextVal(row, j));
            if (d) headerData.contractDate = d;
          }
        }
      }
      // Contract for
      if (joined.includes('CONTRACT FOR')) {
        for (let j = 0; j < row.length; j++) {
          if (str(row[j]).toUpperCase().includes('CONTRACT FOR')) {
            headerData.contractFor = str(row[j + 1] || '');
          }
        }
      }
      // Printed names (signature area)
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
    // Extract owner/architect info and addresses from G702 header area
    for (let i = 0; i < Math.min(20, rows.length); i++) {
      const row = rows[i];
      const prev = i > 0 ? rows[i - 1] : null;
      const joined_i = row.map((c: any) => str(c).toUpperCase()).join('|');
      if (prev && str(prev[0]).toUpperCase().includes('TO OWNER')) {
        if (str(row[1])) headerData.ownerName = headerData.ownerName || str(row[1]);
        const next1 = i + 1 < rows.length ? rows[i + 1] : null;
        const next2 = i + 2 < rows.length ? rows[i + 2] : null;
        if (next1 && str(next1[1])) headerData.ownerAddress = str(next1[1]);
        if (next2 && str(next2[1])) headerData.ownerCity = str(next2[1]);
      }
      if (prev && str(prev[0]).toUpperCase().includes('FROM CONTRACTOR')) {
        if (str(row[1])) headerData.gcCompany = headerData.gcCompany || str(row[1]);
      }
      if (prev && (str(prev[3]).toUpperCase().includes('ARCHITECT') || str(prev[3]).toUpperCase().includes('PROJECT'))) {
        if (str(row[4])) headerData.architectName = headerData.architectName || str(row[4]);
        const next1 = i + 1 < rows.length ? rows[i + 1] : null;
        const next2 = i + 2 < rows.length ? rows[i + 2] : null;
        if (next1 && str(next1[4])) headerData.architectAddress = str(next1[4]);
        if (next2 && str(next2[4])) headerData.architectCity = str(next2[4]);
      }
    }
  }

  // ===== G703 (Line Items) =====
  const g703Name = wb.SheetNames.find(n => /g703|g-703|continuation/i.test(n));
  if (g703Name) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[g703Name], { header: 1, defval: '' });
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

    if (headerRow >= 0) {
      let sortOrder = 0;
      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const c0 = str(row[colIdx.item ?? 0]);
        const c1 = str(row[colIdx.desc ?? 1]);
        if (!c0 && !c1) continue;
        const descUp = c1.toUpperCase();
        if (descUp.includes('GRAND TOTAL') || descUp.includes('POWERED BY')) continue;

        const sv = num(row[colIdx.sched ?? 3]);
        const sub = str(row[colIdx.sub ?? 2]);
        const isSection = /^\d{5}$/.test(c0) && c1 === c1.toUpperCase() && c1.length > 3 && !sv;
        const isSubtotal = /subtotal/i.test(c1);
        const isBelowLine = /below.*line|pass.*through/i.test(c0 + c1) && !isSubtotal;
        const isFee = /^(O&P|GLI|CONT)$/.test(c0) ||
          (/overhead.*profit/i.test(c1) && !isSection) ||
          (/liability.*insurance/i.test(c1) && !isSection) ||
          (/contingency/i.test(c1) && !isSection && !isSubtotal);
        const isTotalRow = /^\s*TOTAL\b/i.test(c1) && !descUp.includes('GRAND');
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
          sortOrder, itemNumber: c0, description: c1, subVendor: sub,
          scheduledValue: sv, budgetRealloc: num(row[colIdx.realloc ?? 4]),
          previousChanges: num(row[colIdx.prevCh ?? 5]), currentChanges: num(row[colIdx.currCh ?? 6]),
          previousCompleted: num(row[colIdx.prevComp ?? 8]), thisCompleted: num(row[colIdx.thisComp ?? 9]),
          retainage: num(row[colIdx.ret ?? 13]),
          isSection, isBelowLine: isBelowLine || /^PA-/i.test(c0), isFee,
          sectionCode, sectionTitle: isSection ? c1 : '',
        });
      }
    }
  }

  return {
    fileName,
    headerData,
    lineItems,
    sheetsFound: { g703: !!g703Name, g702: !!g702Name, settings: !!settingsName },
  };
}

/**
 * POST /api/pay-apps/import-batch
 * 
 * action=preview: parse all uploaded files, return preview data
 * action=import: parse and create all PAs in order
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const formData = await request.formData();
    const action = formData.get('action') as string || 'preview';
    const projectId = formData.get('projectId') as string;
    const files = formData.getAll('files') as File[];

    if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

    // Parse all files
    const parsedPAs: ParsedPA[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = parseExcelBuffer(buffer, file.name);
      parsedPAs.push(parsed);
    }

    // Sort by periodTo date (most reliable), then applicationDate, then applicationNumber, then filename
    parsedPAs.sort((a, b) => {
      const aDate = a.headerData.periodTo || a.headerData.applicationDate || '';
      const bDate = b.headerData.periodTo || b.headerData.applicationDate || '';
      if (aDate && bDate) {
        const da = new Date(aDate).getTime();
        const db = new Date(bDate).getTime();
        if (!isNaN(da) && !isNaN(db) && da !== db) return da - db;
      }
      // If dates are missing or equal, fall back to application number
      const aNum = a.headerData.applicationNumber || 999;
      const bNum = b.headerData.applicationNumber || 999;
      if (aNum !== bNum) return aNum - bNum;
      return a.fileName.localeCompare(b.fileName);
    });

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        count: parsedPAs.length,
        payApplications: parsedPAs.map(pa => ({
          fileName: pa.fileName,
          applicationNumber: pa.headerData.applicationNumber || null,
          applicationDate: pa.headerData.applicationDate || null,
          periodFrom: pa.headerData.periodFrom || null,
          periodTo: pa.headerData.periodTo || null,
          lineItemCount: pa.lineItems.length,
          scheduledValue: pa.lineItems.filter(l => !l.isSection).reduce((s, l) => s + (l.scheduledValue || 0), 0),
          thisCompleted: pa.lineItems.filter(l => !l.isSection).reduce((s, l) => s + (l.thisCompleted || 0), 0),
          previousCompleted: pa.lineItems.filter(l => !l.isSection).reduce((s, l) => s + (l.previousCompleted || 0), 0),
          sheetsFound: pa.sheetsFound,
          headerData: pa.headerData,
        })),
      });
    }

    // === IMPORT ACTION ===
    if (!projectId) return NextResponse.json({ error: 'projectId required for import' }, { status: 400 });
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Get existing PA numbers to avoid duplicates
    const existingPAs = await prisma.payApplication.findMany({
      where: { projectId },
      select: { applicationNumber: true },
    });
    const existingNums = new Set(existingPAs.map(pa => pa.applicationNumber));

    // Get the highest existing PA number
    let nextNum = (existingPAs.length > 0 ? Math.max(...existingPAs.map(pa => pa.applicationNumber)) : 0) + 1;

    const results: { fileName: string; applicationNumber: number; status: 'created' | 'skipped'; lineItems: number; reason?: string }[] = [];

    for (let idx = 0; idx < parsedPAs.length; idx++) {
      const pa = parsedPAs[idx];
      const hdr = pa.headerData;
      // Assign sequential number based on date-sorted order, not from Excel
      const paNum = nextNum + idx;

      // Skip if this PA# already exists
      if (existingNums.has(paNum)) {
        results.push({ fileName: pa.fileName, applicationNumber: paNum, status: 'skipped', lineItems: 0, reason: `PA #${paNum} already exists` });
        continue;
      }

      // Clean header data - remove non-model fields
      const cleanHeader = { ...hdr };
      delete cleanHeader.applicationNumber;
      delete cleanHeader.projectName;
      delete cleanHeader.projectNumber;
      delete cleanHeader.gcCompany;
      delete cleanHeader.opAmount;
      delete cleanHeader.contingencyAmount;
      delete cleanHeader.netChangeByOrders;
      delete cleanHeader.applicationNumber_;
      delete cleanHeader.retainageContPercent;

      try {
        // FIX: AIA G702 forms rarely include "Period From". Falling back to
        // today produced inverted ranges (import day -> past periodTo).
        // Derive missing dates from periodTo: monthly billing cycle.
        const periodToDate = hdr.periodTo ? new Date(hdr.periodTo) : new Date();
        const periodFromDate = hdr.periodFrom
          ? new Date(hdr.periodFrom)
          : new Date(periodToDate.getFullYear(), periodToDate.getMonth(), 1);
        const applicationDate = hdr.applicationDate ? new Date(hdr.applicationDate) : periodToDate;
        // Guard: never allow an inverted range
        const safePeriodFrom = periodFromDate > periodToDate
          ? new Date(periodToDate.getFullYear(), periodToDate.getMonth(), 1)
          : periodFromDate;

        await prisma.payApplication.create({
          data: {
            ...cleanHeader,
            projectId,
            applicationNumber: paNum,
            applicationDate,
            periodFrom: safePeriodFrom,
            periodTo: periodToDate,
            // Imported PAs are real billing documents, not drafts
            status: 'Submitted',
            contractDate: hdr.contractDate ? new Date(hdr.contractDate) : null,
            lineItems: {
              create: pa.lineItems.map((li: any, i: number) => ({
                sortOrder: li.sortOrder ?? i + 1,
                itemNumber: String(li.itemNumber ?? ''),
                sectionCode: String(li.sectionCode ?? ''),
                sectionTitle: String(li.sectionTitle ?? ''),
                description: String(li.description ?? ''),
                subVendor: String(li.subVendor ?? ''),
                scheduledValue: Number(li.scheduledValue) || 0,
                budgetRealloc: Number(li.budgetRealloc) || 0,
                previousChanges: Number(li.previousChanges) || 0,
                currentChanges: Number(li.currentChanges) || 0,
                previousCompleted: Number(li.previousCompleted) || 0,
                thisCompleted: Number(li.thisCompleted) || 0,
                retainage: Number(li.retainage) || 0,
                isSection: li.isSection === true,
                isBelowLine: li.isBelowLine === true,
                isFee: li.isFee === true,
              })),
            },
          },
        });

        existingNums.add(paNum);
        results.push({ fileName: pa.fileName, applicationNumber: paNum, status: 'created', lineItems: pa.lineItems.length });
      } catch (err: any) {
        console.error(`Failed to create PA #${paNum} from ${pa.fileName}:`, err);
        results.push({ fileName: pa.fileName, applicationNumber: paNum, status: 'skipped', lineItems: 0, reason: err.message || 'Database error' });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Batch PA import error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process batch import' }, { status: 500 });
  }
}