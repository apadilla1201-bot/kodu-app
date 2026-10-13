export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { computeProjectedCashflow } from '@/lib/projected-cashflow';

// GET /api/analytics/projected-cashflow?projectId=X
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = (session?.user as any)?.companyId ?? '';
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  try {
    const result = await computeProjectedCashflow(projectId, companyId);
    return NextResponse.json({
      divisions: result.divisions,
      totals: result.totals,
      latestPaNumber: result.latestPaNumber,
      hasData: result.hasData,
      cpm: result.cpm,
    });
  } catch (e: any) {
    if (e?.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    throw e;
  }
}
