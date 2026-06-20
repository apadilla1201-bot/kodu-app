export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

interface ExcelRow {
  coNumber: string;
  status: string;
  date: string | null;
  approvalDate: string | null;
  amount: number;
  description: string;
  csi: string | null;
  overheadProfit: number;
  generalLiability: number;
  totalCO: number;
  runningTotal: number | null;
  contract: number | null;
  notes: string | null;
  ref: string | null;
}

function parseDate(val: any): Date | null {
  if (!val || val === '—' || val === '-') return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + val);
    return epoch;
  }
  const str = String(val).trim();
  // Try MM/DD/YYYY
  const parts = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    return new Date(parseInt(parts[3]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseNumber(val: any): number {
  if (val === null || val === undefined || val === '' || val === '—' || val === '-') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[\$,]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function isValidCORNumber(val: any): boolean {
  if (!val) return false;
  const s = String(val).trim();
  // Match pattern like 169-001, 169-088 etc.
  return /^\d{1,4}-\d{1,4}$/.test(s);
}

// Preview endpoint (GET with query params is not ideal for file upload, so we use action in POST)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any)?.id ?? '';

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const action = formData.get('action') as string; // 'preview' or 'import'
    const projectId = formData.get('projectId') as string;
    const projectNumber = formData.get('projectNumber') as string;
    const projectName = formData.get('projectName') as string;
    const client = formData.get('client') as string;
    const location = formData.get('location') as string;
    const contractAmount = formData.get('contractAmount') as string;
    const startDate = formData.get('startDate') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    // Find CO LOG sheet
    const coLogSheet = workbook.SheetNames.find((name: string) =>
      name.toUpperCase().includes('CO LOG') || name.toUpperCase().includes('LOG')
    ) ?? workbook.SheetNames[0];

    const ws = workbook.Sheets[coLogSheet];
    if (!ws) {
      return NextResponse.json({ error: 'Could not find CO LOG sheet' }, { status: 400 });
    }

    // Get range
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:O100');
    
    // Extract project info from header rows
    let extractedProjectName = '';
    let extractedProjectNumber = '';
    let extractedLocation = '';
    let extractedPM = '';

    // Check first few rows for project info
    for (let r = 0; r <= Math.min(5, range.e.r); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell?.v) {
          const val = String(cell.v);
          // Look for project info in header
          if (val.includes('Project No.') || val.includes('Project No')) {
            const match = val.match(/Project\s*No\.?\s*(\d+)/i);
            if (match) extractedProjectNumber = match[1];
            const pmMatch = val.match(/PM:\s*([^·]+)/i);
            if (pmMatch) extractedPM = pmMatch[1].trim();
            if (extractedPM) {
              const afterPM = val.substring(val.indexOf(extractedPM) + extractedPM.length);
              const addressMatch = afterPM.match(/·\s*([^·]+?)\s*(?:·|$)/);
              if (addressMatch) extractedLocation = addressMatch[1].trim();
            }
          }
          // Look for project name
          if (c >= 7 && r <= 2 && val.length > 3 && !val.includes('THE PROJECT')) {
            extractedProjectName = val;
          }
        }
      }
    }

    // Find header row (look for 'CO #' or 'CO#' in column B)
    let headerRow = -1;
    const columnMap: Record<string, number> = {};

    for (let r = 0; r <= Math.min(15, range.e.r); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell?.v && String(cell.v).trim().toUpperCase().replace(/\s/g, '') === 'CO#') {
          headerRow = r;
          // Map all columns in this row — order matters: check specific patterns before generic ones
          for (let hc = range.s.c; hc <= range.e.c; hc++) {
            const hCell = ws[XLSX.utils.encode_cell({ r, c: hc })];
            if (hCell?.v) {
              const header = String(hCell.v).trim().toUpperCase().replace(/\n/g, ' ');
              if (header.includes('TOTAL CO')) columnMap['totalCO'] = hc;
              else if (header.includes('RUNNING')) columnMap['runningTotal'] = hc;
              else if (header.includes('CONTRACT')) columnMap['contract'] = hc;
              else if (header.includes('CO #') || header === 'CO#') columnMap['coNumber'] = hc;
              else if (header.includes('STATUS')) columnMap['status'] = hc;
              else if (header === 'DATE') columnMap['date'] = hc;
              else if (header.includes('APPR')) columnMap['approvalDate'] = hc;
              else if (header === 'AMOUNT') columnMap['amount'] = hc;
              else if (header.includes('DESC')) columnMap['description'] = hc;
              else if (header.includes('CSI')) columnMap['csi'] = hc;
              else if (header.includes('O&P')) columnMap['overheadProfit'] = hc;
              else if (header.includes('GL')) columnMap['generalLiability'] = hc;
              else if (header.includes('NOTE') || header.includes('SUB')) columnMap['notes'] = hc;
              else if (header.includes('REF')) columnMap['ref'] = hc;
            }
          }
          break;
        }
      }
      if (headerRow >= 0) break;
    }

    // If we found one header for CO# but the mapping is off, try alternative
    if (headerRow < 0) {
      // Fallback: assume standard column layout B=CO#, C=Status, D=Date...
      headerRow = 4;
      columnMap['coNumber'] = 1;
      columnMap['status'] = 2;
      columnMap['date'] = 3;
      columnMap['approvalDate'] = 4;
      columnMap['amount'] = 5;
      columnMap['description'] = 6;
      columnMap['csi'] = 7;
      columnMap['overheadProfit'] = 8;
      columnMap['generalLiability'] = 9;
      columnMap['totalCO'] = 10;
      columnMap['runningTotal'] = 11;
      columnMap['contract'] = 12;
      columnMap['notes'] = 13;
      columnMap['ref'] = 14;
    }

    // Parse data rows - handle multiple sections (Pending, Approved, Rejected)
    const rows: ExcelRow[] = [];
    let currentStatus = '';

    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const coCell = ws[XLSX.utils.encode_cell({ r, c: columnMap['coNumber'] ?? 1 })];
      const coVal = coCell?.v ? String(coCell.v).trim() : '';

      // Check for section headers like "APPROVED (55 COs)"
      if (coVal.toUpperCase().includes('APPROVED')) {
        currentStatus = 'Approved';
        // Skip the next header row (CO#, STATUS, etc repeated)
        continue;
      }
      if (coVal.toUpperCase().includes('PENDING')) {
        currentStatus = 'Pending';
        continue;
      }
      if (coVal.toUpperCase().includes('REJECTED')) {
        currentStatus = 'Rejected';
        continue;
      }

      // Skip header rows repeated in sections
      if (coVal === 'CO #' || coVal === 'CO#') {
        continue;
      }

      // Skip subtotal rows
      if (coVal.toLowerCase().includes('subtotal') || coVal.toLowerCase().includes('total')) {
        continue;
      }

      // Only process valid COR numbers
      if (!isValidCORNumber(coVal)) continue;

      const getCellValue = (key: string) => {
        const col = columnMap[key];
        if (col === undefined) return null;
        const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
        return cell?.v ?? null;
      };

      const statusVal = getCellValue('status');
      const rowStatus = statusVal ? String(statusVal).trim() : currentStatus;

      // Skip VOID entries
      const desc = getCellValue('description');
      const amount = getCellValue('amount');
      const totalCOVal = getCellValue('totalCO');
      if (String(desc ?? '').trim().toUpperCase() === 'VOID') continue;

      // Even if CO LOG row is empty, include it if there's a matching detail sheet
      const hasDetailSheet = workbook.SheetNames.includes(coVal);
      if (!desc && !amount && !totalCOVal && !rowStatus && !hasDetailSheet) continue;

      rows.push({
        coNumber: coVal,
        status: rowStatus || 'Pending',
        date: getCellValue('date') ? String(getCellValue('date')) : null,
        approvalDate: getCellValue('approvalDate') ? String(getCellValue('approvalDate')) : null,
        amount: parseNumber(getCellValue('amount')),
        description: String(desc ?? '').trim(),
        csi: getCellValue('csi') ? String(getCellValue('csi')).trim() : null,
        overheadProfit: parseNumber(getCellValue('overheadProfit')),
        generalLiability: parseNumber(getCellValue('generalLiability')),
        totalCO: parseNumber(getCellValue('totalCO')),
        runningTotal: getCellValue('runningTotal') ? parseNumber(getCellValue('runningTotal')) : null,
        contract: getCellValue('contract') ? parseNumber(getCellValue('contract')) : null,
        notes: getCellValue('notes') ? String(getCellValue('notes')).trim() : null,
        ref: getCellValue('ref') ? String(getCellValue('ref')).trim() : null,
      });
    }

    // Enrich rows that have no data from their individual detail sheets
    for (const row of rows) {
      if (row.description || row.amount > 0) continue; // already has data
      const detailSheet = workbook.Sheets[row.coNumber];
      if (!detailSheet) continue;

      try {
        const detailRange = XLSX.utils.decode_range(detailSheet['!ref'] ?? 'A1:I34');
        let sheetDesc = '';
        let sheetTotal = 0;
        let sheetOP = 0;
        let sheetGL = 0;
        let sheetSubtotal = 0;
        let sheetDate = '';
        let sheetStatus = '';

        for (let dr = 0; dr <= detailRange.e.r; dr++) {
          for (let dc = 0; dc <= detailRange.e.c; dc++) {
            const cell = detailSheet[XLSX.utils.encode_cell({ r: dr, c: dc })];
            if (!cell?.v) continue;
            const val = String(cell.v).trim();

            // Extract description from "SCOPE / DESCRIPTION" section (row after that header)
            if (val.toUpperCase().includes('SCOPE') && val.toUpperCase().includes('DESCRIPTION')) {
              const nextRow = detailSheet[XLSX.utils.encode_cell({ r: dr + 1, c: dc })];
              if (nextRow?.v) sheetDesc = String(nextRow.v).trim();
            }
            // Extract date
            if (val.toUpperCase() === 'DATE:') {
              const dateCell = detailSheet[XLSX.utils.encode_cell({ r: dr, c: dc + 1 })];
              if (dateCell?.v) sheetDate = String(dateCell.v).trim();
            }
            // Extract status
            if (val.toUpperCase().startsWith('STATUS:')) {
              sheetStatus = val.replace(/STATUS:\s*/i, '').trim();
            }
            // Extract total from "TOTAL — XXX-XXX" row
            if (val.toUpperCase().includes('TOTAL') && val.includes(row.coNumber)) {
              // Get the value in the next columns
              for (let tc = dc + 1; tc <= detailRange.e.c; tc++) {
                const tCell = detailSheet[XLSX.utils.encode_cell({ r: dr, c: tc })];
                if (tCell?.v && typeof tCell.v === 'number') {
                  sheetTotal = tCell.v;
                  break;
                }
              }
            }
            // Extract O&P
            if (val.toUpperCase().includes('OVERHEAD') || (val.toUpperCase().includes('O&P') && val.includes('6%'))) {
              for (let tc = dc + 1; tc <= detailRange.e.c; tc++) {
                const tCell = detailSheet[XLSX.utils.encode_cell({ r: dr, c: tc })];
                if (tCell?.v && typeof tCell.v === 'number') {
                  sheetOP = tCell.v;
                  break;
                }
              }
            }
            // Extract GL
            if (val.toUpperCase().includes('LIABILITY') || (val.toUpperCase().includes('GL') && val.includes('1.5%'))) {
              for (let tc = dc + 1; tc <= detailRange.e.c; tc++) {
                const tCell = detailSheet[XLSX.utils.encode_cell({ r: dr, c: tc })];
                if (tCell?.v && typeof tCell.v === 'number') {
                  sheetGL = tCell.v;
                  break;
                }
              }
            }
            // Extract subcontractor total
            if (val.toUpperCase().includes('SUBCONTRACTOR TOTAL') || val.toUpperCase().includes('SUB TOTAL')) {
              for (let tc = dc + 1; tc <= detailRange.e.c; tc++) {
                const tCell = detailSheet[XLSX.utils.encode_cell({ r: dr, c: tc })];
                if (tCell?.v && typeof tCell.v === 'number') {
                  sheetSubtotal = tCell.v;
                  break;
                }
              }
            }
          }
        }

        if (sheetDesc) row.description = sheetDesc;
        if (sheetTotal > 0) row.totalCO = sheetTotal;
        if (sheetOP > 0) row.overheadProfit = sheetOP;
        if (sheetGL > 0) row.generalLiability = sheetGL;
        if (sheetSubtotal > 0) row.amount = sheetSubtotal;
        if (sheetDate && !row.date) row.date = sheetDate;
        if (sheetStatus && row.status === 'Pending') {
          row.status = sheetStatus.charAt(0).toUpperCase() + sheetStatus.slice(1).toLowerCase();
        }

        console.log(`[Import Excel] Enriched ${row.coNumber} from detail sheet: desc="${row.description}", total=${row.totalCO}`);
      } catch (e) {
        console.error(`[Import Excel] Error reading detail sheet ${row.coNumber}:`, e);
      }
    }

    // Keep rows that have description, amount, or totalCO
    const validRows = rows.filter(r => r.description || r.amount > 0 || r.totalCO > 0);

    console.log('[Import Excel] Column map:', JSON.stringify(columnMap));
    console.log('[Import Excel] Header row:', headerRow);
    console.log('[Import Excel] Valid rows found:', validRows.length);
    if (validRows.length > 0) {
      console.log('[Import Excel] First row sample:', JSON.stringify(validRows[0]));
    }

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        projectInfo: {
          projectNumber: extractedProjectNumber,
          projectName: extractedProjectName,
          location: extractedLocation,
          pm: extractedPM,
        },
        sheets: workbook.SheetNames,
        totalRows: validRows.length,
        rows: validRows,
        summary: {
          pending: validRows.filter(r => r.status === 'Pending').length,
          approved: validRows.filter(r => r.status === 'Approved').length,
          rejected: validRows.filter(r => r.status === 'Rejected').length,
          totalAmount: validRows.reduce((s, r) => s + r.totalCO, 0),
        },
      });
    }

    // IMPORT action
    if (action === 'import') {
      // Create or find the project
      let project;
      if (projectId) {
        project = await prisma.project.findFirst({ where: { id: projectId, userId } });
        if (!project) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
      } else {
        // Create new project
        project = await prisma.project.create({
          data: {
            projectNumber: projectNumber || extractedProjectNumber || '000',
            projectName: projectName || extractedProjectName || 'Imported Project',
            client: client || 'TBD',
            location: location || extractedLocation || null,
            contractAmount: contractAmount ? parseFloat(contractAmount) : 0,
            startDate: startDate ? new Date(startDate) : null,
            userId,
          },
        });
      }

      // Import CORs
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const row of validRows) {
        try {
          // Check if COR already exists
          const existing = await prisma.changeOrder.findFirst({
            where: { projectId: project.id, corNumber: row.coNumber },
          });
          if (existing) {
            skipped++;
            continue;
          }

          // Extract sequence number from COR number
          const seqParts = row.coNumber.split('-');
          const seqNum = parseInt(seqParts[seqParts.length - 1]) || 0;

          const parsedDate = parseDate(row.date);
          const parsedApprDate = parseDate(row.approvalDate);

          // For CORs with totalCO but no amount, back-calculate from totalCO
          // Total = Amount + O&P(6%) + GL(1.5%) = Amount * 1.075
          let subtotalVal = row.amount;
          let opVal = row.overheadProfit;
          let glVal = row.generalLiability;
          let totalVal = row.totalCO;

          if (subtotalVal === 0 && totalVal > 0) {
            // Back-calculate: total = subtotal * 1.075
            subtotalVal = Math.round((totalVal / 1.075) * 100) / 100;
            opVal = Math.round(subtotalVal * 0.06 * 100) / 100;
            glVal = Math.round(subtotalVal * 0.015 * 100) / 100;
          }
          if (totalVal === 0 && subtotalVal > 0) {
            totalVal = subtotalVal + opVal + glVal;
          }

          await prisma.changeOrder.create({
            data: {
              projectId: project.id,
              corNumber: row.coNumber,
              sequence: seqNum,
              date: parsedDate || new Date(),
              description: row.description || `COR ${row.coNumber} (see detail sheet)`,
              subcontractor: (row.notes && row.notes !== '—') ? row.notes : null,
              status: row.status || 'Pending',
              approvalDate: parsedApprDate,
              csiCode: (row.csi && row.csi !== '—') ? row.csi : null,
              subtotal: subtotalVal,
              overheadProfit: opVal,
              generalLiability: glVal,
              salesTax: 0,
              totalAmount: totalVal,
              notes: row.ref || null,
            },
          });
          imported++;
        } catch (err: any) {
          errors.push(`COR ${row.coNumber}: ${err?.message ?? 'Unknown error'}`);
        }
      }

      return NextResponse.json({
        success: true,
        projectId: project.id,
        imported,
        skipped,
        total: validRows.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use preview or import.' }, { status: 400 });
  } catch (error: any) {
    console.error('Import Excel error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to process Excel file' }, { status: 500 });
  }
}
