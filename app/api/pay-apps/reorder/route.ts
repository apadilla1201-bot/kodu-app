export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/pay-apps/reorder
 * 
 * Re-numbers all PAs for a project in chronological order by periodTo date.
 * Body: { projectId: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const { projectId } = await request.json();
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Fetch all PAs for this project
    const payApps = await prisma.payApplication.findMany({
      where: { projectId },
      select: { id: true, applicationNumber: true, periodTo: true, periodFrom: true, applicationDate: true },
      orderBy: { applicationNumber: 'asc' },
    });

    if (payApps.length === 0) {
      return NextResponse.json({ success: true, message: 'No pay applications to reorder', changes: [] });
    }

    // Sort by periodTo date (primary), then periodFrom, then applicationDate
    const sorted = [...payApps].sort((a, b) => {
      const aTime = a.periodTo?.getTime() || a.applicationDate?.getTime() || 0;
      const bTime = b.periodTo?.getTime() || b.applicationDate?.getTime() || 0;
      if (aTime !== bTime) return aTime - bTime;
      const aFrom = a.periodFrom?.getTime() || 0;
      const bFrom = b.periodFrom?.getTime() || 0;
      return aFrom - bFrom;
    });

    // Check which ones need renumbering
    const changes: { id: string; oldNumber: number; newNumber: number; periodTo: string }[] = [];

    // First pass: use temporary negative numbers to avoid unique constraint violations
    for (let i = 0; i < sorted.length; i++) {
      const pa = sorted[i];
      const newNum = i + 1;
      if (pa.applicationNumber !== newNum) {
        changes.push({
          id: pa.id,
          oldNumber: pa.applicationNumber,
          newNumber: newNum,
          periodTo: pa.periodTo?.toISOString() || '',
        });
      }
    }

    if (changes.length === 0) {
      return NextResponse.json({ success: true, message: 'PAs are already in correct order', changes: [] });
    }

    // Use a transaction with temporary numbers to avoid unique constraint violations
    // Step 1: Set all to negative temporary numbers
    // Step 2: Set all to correct positive numbers
    await prisma.$transaction(async (tx) => {
      // Step 1: Move all to temporary negative numbers
      for (let i = 0; i < sorted.length; i++) {
        await tx.payApplication.update({
          where: { id: sorted[i].id },
          data: { applicationNumber: -(i + 1) },
        });
      }
      // Step 2: Set correct positive numbers
      for (let i = 0; i < sorted.length; i++) {
        await tx.payApplication.update({
          where: { id: sorted[i].id },
          data: { applicationNumber: i + 1 },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Reordered ${changes.length} pay application(s) by date`,
      total: sorted.length,
      changes,
    });
  } catch (error: any) {
    console.error('PA reorder error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to reorder' }, { status: 500 });
  }
}
