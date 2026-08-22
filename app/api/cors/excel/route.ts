export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getSessionLocale } from '@/lib/i18n/server';
import * as XLSX from 'xlsx';

const dayDiff = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / 86400000);

const fmtMoney = (v: number | null | undefined): number =>
  v ?? 0;

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

    // Helper to build sheet data
    const buildSheet = (data: any[], title: string) => {
      const rows: any[] = [
        [`CHANGE ORDER LOG — ${title}`],
        [`${project.projectNumber ?? ''} — ${project.projectName ?? ''}${project.client ? ` · ${project.client}` : ''}`],
        [],
        ['COR #', 'DATE', 'DESCRIPTION', 'SUBCONTRACTOR', 'AMOUNT', 'STATUS', 'APPROVED', 'DAYS PENDING', 'DECIDED BY'],
      ];
      data.forEach((i: any) => {
        const days = i.approvalDate
          ? dayDiff(new Date(i.date), new Date(i.approvalDate))
          : dayDiff(new Date(i.date), now);
        rows.push([
          i.corNumber || '',
          fmtDateShort(i.date),
          i.description || '',
          i.subcontractor || '',
          fmtMoney(i.totalAmount),
          i.status || '',
          fmtDateShort(i.approvalDate),
          days >= 0 ? days : '',
          i.decidedBy || '',
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Column widths
      ws['!cols'] = [
        { wch: 12 }, { wch: 12 }, { wch: 60 }, { wch: 24 },
        { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
      ];
      return ws;
    };

    const wb = XLSX.utils.book_new();

    // Sheet: Resumen
    const resumenRows = [
      ['CHANGE ORDER LOG — RESUMEN'],
      [`${project.projectNumber ?? ''} — ${project.projectName ?? ''}`],
      [],
      ['STATUS', '# CORs', 'AMOUNT', '% OF TOTAL'],
      ['Pending', pendingItems.length, totalsAll.pending, totalsAll.all > 0 ? totalsAll.pending / totalsAll.all : 0],
      ['Approved', approvedItems.length, totalsAll.approved, totalsAll.all > 0 ? totalsAll.approved / totalsAll.all : 0],
      ['Rejected', rejectedItems.length, totalsAll.all - totalsAll.pending - totalsAll.approved, totalsAll.all > 0 ? (totalsAll.all - totalsAll.pending - totalsAll.approved) / totalsAll.all : 0],
      ['TOTAL', items.length, totalsAll.all, 1],
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
    wsResumen['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // Other sheets
    XLSX.utils.book_append_sheet(wb, buildSheet(pendingItems, 'PENDING'), 'Pending');
    XLSX.utils.book_append_sheet(wb, buildSheet(approvedItems, 'APPROVED'), 'Approved');
    XLSX.utils.book_append_sheet(wb, buildSheet(rejectedItems, 'REJECTED'), 'Rejected');
    XLSX.utils.book_append_sheet(wb, buildSheet(items, 'TODOS'), 'Todos');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

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
