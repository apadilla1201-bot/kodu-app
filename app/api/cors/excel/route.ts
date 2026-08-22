export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getSessionLocale } from '@/lib/i18n/server';

const dayDiff = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / 86400000);

const fmtMoney = (v: number | null | undefined): string =>
  (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDateShort = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const items = await prisma.changeOrder.findMany({
      where: { projectId },
      orderBy: { sequence: 'asc' },
    });

    const now = new Date();
    const APPROVED = ['Approved', 'Executed'];
    const PENDING = ['Draft', 'Pending', 'Submitted'];

    const totalsAll = items.reduce((acc: any, i: any) => ({
      all: acc.all + (i.totalAmount || 0),
      approved: acc.approved + (APPROVED.includes(i.status) ? (i.totalAmount || 0) : 0),
      pending: acc.pending + (PENDING.includes(i.status) ? (i.totalAmount || 0) : 0),
    }), { all: 0, approved: 0, pending: 0 });

    const pendingItems = items.filter((i: any) => PENDING.includes(i.status));
    const approvedItems = items.filter((i: any) => APPROVED.includes(i.status));
    const rejectedItems = items.filter((i: any) => i.status === 'Rejected');

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    // Helper to create a sheet
    const createSheet = (name: string, data: any[], subtitle: string) => {
      const sheet = workbook.addWorksheet(name);
      // Title
      sheet.mergeCells('A1:I1');
      sheet.getCell('A1').value = `CHANGE ORDER LOG — ${subtitle}`;
      sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F1B33' } };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      // Project info
      sheet.mergeCells('A2:I2');
      sheet.getCell('A2').value = `${project.projectNumber ?? ''} — ${project.projectName ?? ''}${project.client ? ` · ${project.client}` : ''}`;
      sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };
      sheet.getCell('A2').alignment = { horizontal: 'center' };

      // Headers
      const headers = ['COR #', 'DATE', 'DESCRIPTION', 'SUBCONTRACTOR', 'AMOUNT', 'STATUS', 'APPROVED', 'DAYS PENDING', 'DECIDED BY'];
      sheet.addRow(headers);
      const headerRow = sheet.getRow(4);
      headerRow.eachCell((cell: any) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1B33' } };
        cell.alignment = { horizontal: 'center' };
      });

      // Data rows
      data.forEach((i: any) => {
        const days = i.approvalDate
          ? dayDiff(new Date(i.date), new Date(i.approvalDate))
          : dayDiff(new Date(i.date), now);
        sheet.addRow([
          i.corNumber || '',
          fmtDateShort(i.date),
          i.description || '',
          i.subcontractor || '',
          i.totalAmount || 0,
          i.status || '',
          fmtDateShort(i.approvalDate),
          days >= 0 ? days : '',
          i.decidedBy || '',
        ]);
      });

      // Column widths
      sheet.columns = [
        { width: 12 }, { width: 12 }, { width: 50 }, { width: 20 },
        { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 18 },
      ];

      // Format amount column as currency
      sheet.getColumn(5).numFmt = '$#,##0.00';
    };

    // Create sheets
    createSheet('Resumen', items, 'RESUMEN');
    createSheet('Pending', pendingItems, 'PENDING');
    createSheet('Approved', approvedItems, 'APPROVED');
    createSheet('Rejected', rejectedItems, 'REJECTED');
    createSheet('Todos', items, 'TODOS');

    // Fill Resumen sheet with summary data
    const resumen = workbook.getWorksheet('Resumen');
    resumen.getRow(6).values = ['STATUS', '# CORs', 'AMOUNT', '% OF TOTAL'];
    resumen.getRow(6).eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1B33' } };
    });
    const totalAll = totalsAll.all;
    resumen.getRow(7).values = ['Pending', pendingItems.length, totalsAll.pending, totalAll > 0 ? (totalsAll.pending / totalAll) : 0];
    resumen.getRow(8).values = ['Approved', approvedItems.length, totalsAll.approved, totalAll > 0 ? (totalsAll.approved / totalAll) : 0];
    resumen.getRow(9).values = ['Rejected', rejectedItems.length, totalsAll.all - totalsAll.pending - totalsAll.approved, totalAll > 0 ? ((totalsAll.all - totalsAll.pending - totalsAll.approved) / totalAll) : 0];
    resumen.getRow(10).values = ['TOTAL', items.length, totalAll, 1];
    resumen.getRow(10).eachCell((cell: any) => { cell.font = { bold: true }; });
    resumen.getColumn(3).numFmt = '$#,##0.00';
    resumen.getColumn(4).numFmt = '0.0%';

    const buffer = await workbook.xlsx.writeBuffer();

    const fname = `Change_Order_Log_${project.projectNumber ?? 'project'}_by_Status.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fname}"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/cors/excel error:', error);
    return NextResponse.json({ error: 'Failed to generate change order log Excel' }, { status: 500 });
  }
}
