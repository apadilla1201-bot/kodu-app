export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/pay-apps/delete-all
 * Deletes ALL pay applications for a given project.
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

    // Count before deleting
    const count = await prisma.payApplication.count({ where: { projectId } });
    if (count === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: 'No pay applications to delete' });
    }

    // Delete all line items first (cascade should handle this, but be explicit)
    await prisma.payAppLineItem.deleteMany({
      where: { payApplication: { projectId } },
    });

    // Delete all pay applications
    const result = await prisma.payApplication.deleteMany({ where: { projectId } });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Deleted ${result.count} pay application(s)`,
    });
  } catch (error: any) {
    console.error('Delete all PAs error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete' }, { status: 500 });
  }
}
