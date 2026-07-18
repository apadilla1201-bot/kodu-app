export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/pay-apps/delete-last
 * Deletes the LAST (highest applicationNumber) pay application for a given project.
 * Body: { projectId: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any)?.id ?? '';

    const { projectId } = await request.json();
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // FIX: scope by tenant (companyId), not userId — migrated projects belong
    // to the company; the userId lookup returned "Project not found".
    let companyId = (session?.user as any)?.companyId ?? '';
    if (!companyId) {
      const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
      companyId = dbUser?.companyId ?? '';
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Find the last PA (highest applicationNumber)
    const lastPA = await prisma.payApplication.findFirst({
      where: { projectId },
      orderBy: { applicationNumber: 'desc' },
    });

    if (!lastPA) {
      return NextResponse.json({ success: true, deleted: 0, message: 'No pay applications to delete' });
    }

    // Delete line items for this PA first
    await prisma.payAppLineItem.deleteMany({
      where: { payApplicationId: lastPA.id },
    });

    // Delete the PA
    await prisma.payApplication.delete({ where: { id: lastPA.id } });

    return NextResponse.json({
      success: true,
      deleted: 1,
      deletedPA: {
        applicationNumber: lastPA.applicationNumber,
        periodTo: lastPA.periodTo,
      },
      message: `Deleted Pay Application #${lastPA.applicationNumber}`,
    });
  } catch (error: any) {
    console.error('Delete last PA error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete' }, { status: 500 });
  }
}
