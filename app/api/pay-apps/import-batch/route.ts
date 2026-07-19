export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseExcelBuffer, sortParsedPAs, toPreviewPA, type ParsedPA } from '@/lib/pa-parser';

/**
 * POST /api/pay-apps/import-batch
 *
 * Two payloads are supported:
 *  A) parsedJson (preferred): the client parsed the workbooks locally and
 *     sends only the extracted data — small payload, no upload limits.
 *  B) files (fallback): raw .xlsx files uploaded via FormData; parsed here.
 *     One unreadable file no longer fails the batch — it is reported by name.
 *
 * action=preview: return extracted data per file
 * action=import:  create all PAs in chronological order
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const formData = await request.formData();
    const action = formData.get('action') as string || 'preview';
    const projectId = formData.get('projectId') as string;

    const parsedPAs: ParsedPA[] = [];
    const parseErrors: { fileName: string; error: string }[] = [];

    const parsedJson = formData.get('parsedJson');
    if (typeof parsedJson === 'string' && parsedJson.length > 0) {
      try {
        const arr = JSON.parse(parsedJson);
        if (!Array.isArray(arr) || arr.length === 0) throw new Error('empty');
        parsedPAs.push(...arr);
      } catch {
        return NextResponse.json({ error: 'Invalid import payload. Please re-analyze the files and try again.' }, { status: 400 });
      }
    } else {
      const files = formData.getAll('files') as File[];
      if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 });
      for (const file of files) {
        try {
          const u8 = new Uint8Array(await file.arrayBuffer());
          parsedPAs.push(parseExcelBuffer(u8, file.name));
        } catch (e: any) {
          console.error(`Failed to parse ${file.name}:`, e?.message);
          parseErrors.push({ fileName: file.name, error: e?.message || 'Not a readable Excel file' });
        }
      }
    }

    if (parsedPAs.length === 0) {
      const detail = parseErrors.length
        ? `Could not read ${parseErrors[0].fileName}: ${parseErrors[0].error}`
        : 'No valid Pay Applications found in the uploaded files';
      return NextResponse.json({ error: detail, parseErrors }, { status: 400 });
    }

    // Chronological order drives PA numbering
    const sorted = sortParsedPAs(parsedPAs);

    if (action === 'preview') {
      return NextResponse.json({
        success: true,
        count: sorted.length,
        payApplications: sorted.map(pa => ({ ...toPreviewPA(pa), headerData: pa.headerData })),
        ...(parseErrors.length ? { parseErrors } : {}),
      });
    }

    // === IMPORT ACTION ===
    if (!projectId) return NextResponse.json({ error: 'projectId required for import' }, { status: 400 });
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Get existing PA numbers AND periods to avoid duplicates
    const existingPAs = await prisma.payApplication.findMany({
      where: { projectId },
      select: { applicationNumber: true, periodTo: true },
    });
    const existingNums = new Set(existingPAs.map(pa => pa.applicationNumber));
    // Same project + same billing period (Period To) = same PA. This makes
    // re-running an import idempotent instead of creating duplicates.
    const existingPeriods = new Map<string, number>();
    for (const ep of existingPAs) {
      if (ep.periodTo) existingPeriods.set(ep.periodTo.toISOString().slice(0, 10), ep.applicationNumber);
    }

    // Next available number; only consumed when a PA is actually created
    let nextAvailable = (existingPAs.length > 0 ? Math.max(...existingPAs.map(pa => pa.applicationNumber)) : 0) + 1;

    const results: { fileName: string; applicationNumber: number; status: 'created' | 'skipped'; lineItems: number; reason?: string }[] = [];

    for (let idx = 0; idx < sorted.length; idx++) {
      const pa = sorted[idx];
      const hdr = pa.headerData;

      // Skip if this billing period was already imported (idempotent re-runs)
      const periodKey = hdr.periodTo ? new Date(hdr.periodTo).toISOString().slice(0, 10) : null;
      if (periodKey && existingPeriods.has(periodKey)) {
        const existingNum = existingPeriods.get(periodKey)!;
        results.push({ fileName: pa.fileName, applicationNumber: existingNum, status: 'skipped', lineItems: 0, reason: `Period ${periodKey} already imported as PA #${existingNum}` });
        continue;
      }

      // Assign sequential number based on date-sorted order, not from Excel
      const paNum = nextAvailable++;

      // Skip if this PA# already exists (defensive; racing imports)
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
        if (periodKey) existingPeriods.set(periodKey, paNum);
        results.push({ fileName: pa.fileName, applicationNumber: paNum, status: 'created', lineItems: pa.lineItems.length });
      } catch (err: any) {
        console.error(`Failed to create PA #${paNum} from ${pa.fileName}:`, err);
        results.push({ fileName: pa.fileName, applicationNumber: paNum, status: 'skipped', lineItems: 0, reason: err.message || 'Database error' });
      }
    }

    // Files that failed to parse (only possible via raw-file fallback path)
    for (const pe of parseErrors) {
      results.push({ fileName: pe.fileName, applicationNumber: 0, status: 'skipped', lineItems: 0, reason: `Could not read file: ${pe.error}` });
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
