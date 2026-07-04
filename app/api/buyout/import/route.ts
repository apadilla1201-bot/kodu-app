export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseBuyoutWorkbook } from '@/lib/buyout-import';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const form = await request.formData();
    const projectId = String(form.get('projectId') || '');
    const file = form.get('file') as File | null;
    const replace = form.get('replace') !== 'false';

    if (!projectId || !file) {
      return NextResponse.json({ error: 'projectId and file are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseBuyoutWorkbook(buffer);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No buyout rows found in file' }, { status: 400 });
    }

    if (replace) {
      await prisma.buyoutItem.deleteMany({ where: { projectId } });
    }

    await prisma.buyoutItem.createMany({
      data: rows.map((r) => ({
        projectId,
        ...r,
      })),
    });

    return NextResponse.json({
      success: true,
      imported: rows.length,
      projectId,
      projectNumber: project.projectNumber,
    });
  } catch (error: any) {
    console.error('POST /api/buyout/import error:', error);
    return NextResponse.json(
      { error: 'Failed to import buyout', details: error?.message },
      { status: 500 }
    );
  }
}
