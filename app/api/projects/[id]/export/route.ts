export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';
    const project = await prisma.project.findFirst({
      where: { id: params?.id ?? '', companyId },
      include: {
        changeOrders: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const headers = ['CO #', 'Status', 'Date', 'Description', 'Subcontractor', 'Amount', 'O&P 6%', 'GL 1.5%', 'Total CO'];
    const rows = (project?.changeOrders ?? []).map((co: any) => [
      co?.corNumber ?? '',
      co?.status ?? '',
      co?.date ? new Date(co.date).toLocaleDateString('en-US') : '',
      `"${(co?.description ?? '').replace(/"/g, '""')}"`,
      `"${(co?.subcontractor ?? '').replace(/"/g, '""')}"`,
      (co?.subtotal ?? 0).toFixed(2),
      (co?.overheadProfit ?? 0).toFixed(2),
      (co?.generalLiability ?? 0).toFixed(2),
      (co?.totalAmount ?? 0).toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="COR_Log_${project?.projectNumber ?? 'export'}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
