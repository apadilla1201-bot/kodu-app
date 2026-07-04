export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { collectEmails, resolveEmailAddress, sendRfiAssignedEmail } from '@/lib/email';

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
      priority, submittedBy, submittedByRole, submittedByEmail,
      assignedTo, assignedToRole, assignedToEmail,
      superintendentName, superintendentEmail,
      requestingSubName, requestingSubEmail,
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

    const pmName = submittedBy ? String(submittedBy) : (session.user?.name || 'Project Manager');
    const pmEmail = resolveEmailAddress(submittedByEmail, session.user?.email);
    const assigneeName = String(assignedTo || '');
    const assigneeEmail = resolveEmailAddress(assignedToEmail, assignedTo);

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
        submittedBy: pmName,
        submittedByRole: submittedByRole ? String(submittedByRole) : 'Project Manager',
        submittedByEmail: pmEmail,
        assignedTo: assigneeName,
        assignedToRole: assignedToRole ? String(assignedToRole) : null,
        assignedToEmail: assigneeEmail,
        superintendentName: superintendentName ? String(superintendentName) : null,
        superintendentEmail: resolveEmailAddress(superintendentEmail),
        requestingSubName: requestingSubName ? String(requestingSubName) : null,
        requestingSubEmail: resolveEmailAddress(requestingSubEmail),
        ballInCourt: assigneeName || null,
        ballInCourtRole: assignedToRole ? String(assignedToRole) : null,
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

    // Email: To = assignee (must respond); CC = PM, superintendent, requesting sub
    try {
      const toList = collectEmails(assigneeEmail);
      const ccList = collectEmails(
        pmEmail,
        superintendentEmail,
        requestingSubEmail,
        session.user?.email,
      ).filter((e) => !toList.includes(e));

      // If no assignee email, send to PM so the RFI is not lost
      const primaryTo = toList.length ? toList : collectEmails(pmEmail, session.user?.email);

      if (primaryTo.length) {
        await sendRfiAssignedEmail({
          to: primaryTo,
          cc: ccList,
          replyTo: pmEmail || undefined,
          rfiId: rfi.id,
          rfiNumber: rfi.rfiNumber,
          projectName: project.projectName,
          projectNumber: project.projectNumber,
          subject: String(subject),
          question: String(question),
          assignedTo: assigneeName,
          submittedBy: pmName,
          dueDate: dateDue,
          priority: priority || 'Normal',
          ballInCourt: assigneeName,
          superintendent: superintendentName ? String(superintendentName) : undefined,
          requestingSub: requestingSubName ? String(requestingSubName) : undefined,
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
