export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { draftRfiFromFieldNote } from '@/lib/rfi-draft';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json();
    const note = String(body?.note || body?.text || '').trim();
    const projectId = String(body?.projectId || '');

    if (!note) {
      return NextResponse.json({ error: 'note text is required' }, { status: 400 });
    }

    let context: { projectName?: string; projectNumber?: string } = {};
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      context = { projectName: project.projectName, projectNumber: project.projectNumber };
    }

    const draft = await draftRfiFromFieldNote(note, context);
    return NextResponse.json({ draft });
  } catch (error: any) {
    console.error('POST /api/rfis/draft-from-text error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to draft RFI' }, { status: 500 });
  }
}
