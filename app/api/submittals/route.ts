export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveEmailAddress, sendSubmittalEmail } from '@/lib/email';

function submittalNotifyEmail(...candidates: (string | null | undefined)[]) {
  return resolveEmailAddress(...candidates, process.env.SUBMITTAL_NOTIFY_EMAIL);
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const where: any = { project: { companyId } };
    if (projectId) where.projectId = projectId;

    const submittals = await prisma.submittal.findMany({
      where,
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(submittals);
  } catch (error: any) {
    console.error('GET /api/submittals error:', error);
    return NextResponse.json({ error: 'Failed to fetch submittals' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json();
    const {
      projectId, title, description, submittalType, specSection, subcontractor,
      priority, status, requiredDate, submittedBy, notes, attachments, notifyEmail,
    } = body ?? {};

    if (!projectId || !title) {
      return NextResponse.json({ error: 'Project and title are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const last = await prisma.submittal.findFirst({
      where: { projectId },
      orderBy: { sequence: 'desc' },
    });
    const nextSeq = (last?.sequence ?? 0) + 1;
    const submittalNumber = `${project.projectNumber}-SUB-${String(nextSeq).padStart(3, '0')}`;

    const submittal = await prisma.submittal.create({
      data: {
        projectId,
        submittalNumber,
        sequence: nextSeq,
        title,
        description: description ?? null,
        submittalType: submittalType ?? 'Shop Drawing',
        specSection: specSection ?? null,
        subcontractor: subcontractor ?? null,
        priority: priority ?? 'Normal',
        status: status ?? 'Draft',
        requiredDate: requiredDate ? new Date(requiredDate) : null,
        submittedBy: submittedBy ?? session.user?.name ?? null,
        submittedDate: status === 'Submitted' ? new Date() : null,
        notes: notes ?? null,
        attachments: attachments?.length
          ? {
              create: attachments.map((a: any) => ({
                fileName: a.fileName,
                fileType: a.fileType ?? null,
                cloudStoragePath: a.cloudStoragePath,
                isPublic: a.isPublic ?? false,
              })),
            }
          : undefined,
      },
      include: { project: true, attachments: true },
    });

    if (submittal.status === 'Submitted') {
      try {
        const to = submittalNotifyEmail(notifyEmail, session.user?.email);
        if (to) {
          await sendSubmittalEmail({
            to,
            event: 'submitted',
            submittalId: submittal.id,
            submittalNumber: submittal.submittalNumber,
            title: submittal.title,
            projectName: project.projectName,
            projectNumber: project.projectNumber,
            subcontractor: submittal.subcontractor,
            submittedBy: submittal.submittedBy,
          });
        }
      } catch (emailErr) {
        console.error('Submittal submitted email error:', emailErr);
      }
    }

    return NextResponse.json(submittal, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/submittals error:', error);
    return NextResponse.json({ error: 'Failed to create submittal' }, { status: 500 });
  }
}
