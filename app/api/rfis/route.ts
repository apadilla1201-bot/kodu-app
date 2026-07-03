export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveEmailAddress, sendRfiAssignedEmail } from '@/lib/email';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const where: any = { project: { companyId } };
    if (projectId) where.projectId = projectId;

    const rfis = await prisma.rFI.findMany({
      where,
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(rfis);
  } catch (error: any) {
    console.error('GET /api/rfis error:', error);
    return NextResponse.json({ error: 'Failed to fetch RFIs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json();
    const {
      projectId, subject, question, discipline, drawingReference, specReference,
      priority,       submittedBy, submittedByRole, assignedTo, assignedToRole, assignedToEmail,
      daysToRespond, costImpact, scheduleImpact, scheduleImpactDays, notes,
      attachments,
    } = body ?? {};

    if (!projectId || !subject || !question) {
      return NextResponse.json({ error: 'Project, subject and question are required' }, { status: 400 });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get next sequence
    const lastRfi = await prisma.rFI.findFirst({
      where: { projectId },
      orderBy: { sequence: 'desc' },
    });
    const nextSeq = (lastRfi?.sequence ?? 0) + 1;
    const rfiNumber = `${project.projectNumber}-${String(nextSeq).padStart(3, '0')}`;

    // Calculate due date
    const days = daysToRespond ? parseInt(String(daysToRespond)) : 7;
    const dateDue = new Date();
    dateDue.setDate(dateDue.getDate() + days);

    const rfi = await prisma.rFI.create({
      data: {
        projectId,
        rfiNumber,
        sequence: nextSeq,
        subject: String(subject),
        question: String(question),
        discipline: discipline ? String(discipline) : null,
        drawingReference: drawingReference ? String(drawingReference) : null,
        specReference: specReference ? String(specReference) : null,
        priority: priority || 'Normal',
        status: 'Open',
        submittedBy: submittedBy ? String(submittedBy) : 'Augusto Padilla',
        submittedByRole: submittedByRole ? String(submittedByRole) : 'Project Manager',
        assignedTo: String(assignedTo || ''),
        assignedToRole: assignedToRole ? String(assignedToRole) : null,
        daysToRespond: days,
        dateDue,
        costImpact: costImpact || 'TBD',
        scheduleImpact: scheduleImpact || 'TBD',
        scheduleImpactDays: scheduleImpactDays ? parseInt(String(scheduleImpactDays)) : null,
        notes: notes ? String(notes) : null,
        attachments: (attachments && attachments.length > 0) ? {
          create: attachments.map((att: any) => ({
            fileName: att.fileName,
            fileType: att.fileType || null,
            cloudStoragePath: att.cloudStoragePath,
            isPublic: att.isPublic || false,
            attachmentType: att.attachmentType || 'question',
          })),
        } : undefined,
      },
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        attachments: true,
      },
    });

    // Send email notification for RFI assignment
    try {
      const recipient = resolveEmailAddress(
        assignedToEmail,
        assignedTo,
        session.user?.email,
      );
      if (recipient) {
        await sendRfiAssignedEmail({
          to: recipient,
          rfiId: rfi.id,
          rfiNumber: rfi.rfiNumber,
          projectName: project.projectName,
          projectNumber: project.projectNumber,
          subject: String(subject),
          question: String(question),
          assignedTo: String(assignedTo || ''),
          submittedBy: String(submittedBy || session.user?.name || 'Project Manager'),
          dueDate: dateDue,
          priority: priority || 'Normal',
        });
      }
    } catch (emailErr) {
      console.error('RFI notification email error:', emailErr);
    }

    return NextResponse.json(rfi, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/rfis error:', error);
    return NextResponse.json({ error: 'Failed to create RFI' }, { status: 500 });
  }
}
