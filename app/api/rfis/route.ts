export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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
      priority, submittedBy, submittedByRole, assignedTo, assignedToRole,
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
      const appUrl = process.env.NEXTAUTH_URL || '';
      const appName = appUrl ? new URL(appUrl).hostname.split('.')[0] : 'PDG COR Manager';
      const htmlBody = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0F1B33;padding:16px 20px;border-radius:8px 8px 0 0;">
            <h2 style="color:#C9A96E;margin:0;">New RFI Assigned</h2>
          </div>
          <div style="background:#f9fafb;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
            <p><strong>RFI #:</strong> ${rfi.rfiNumber}</p>
            <p><strong>Project:</strong> ${project.projectName} (#${project.projectNumber})</p>
            <p><strong>Subject:</strong> ${String(subject)}</p>
            <p><strong>Priority:</strong> ${priority || 'Normal'}</p>
            <p><strong>Assigned To:</strong> ${String(assignedTo || '')}</p>
            <p><strong>Submitted By:</strong> ${String(submittedBy || 'Augusto Padilla')}</p>
            <p><strong>Due Date:</strong> ${dateDue.toLocaleDateString('en-US')}</p>
            <div style="background:white;padding:15px;border-radius:4px;border-left:4px solid #C9A96E;margin:12px 0;">
              <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;">Question</p>
              <p style="margin:4px 0 0 0;">${String(question).substring(0, 500)}</p>
            </div>
          </div>
        </div>
      `;
      await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          app_id: process.env.WEB_APP_ID,
          notification_id: process.env.NOTIF_ID_RFI_ASSIGNED,
          subject: `RFI ${rfi.rfiNumber} Assigned — ${String(subject).substring(0, 60)}`,
          body: htmlBody,
          is_html: true,
          recipient_email: 'apadilla1201@gmail.com',
          sender_email: `noreply@${new URL(appUrl).hostname}`,
          sender_alias: 'PDG RFI Manager',
        }),
      });
    } catch (emailErr) {
      console.error('RFI notification email error:', emailErr);
    }

    return NextResponse.json(rfi, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/rfis error:', error);
    return NextResponse.json({ error: 'Failed to create RFI' }, { status: 500 });
  }
}
