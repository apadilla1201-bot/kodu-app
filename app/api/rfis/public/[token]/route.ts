export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectEmails, sendRfiAnsweredEmail } from '@/lib/email';
import { appBaseUrl } from '@/lib/app-url';
import { randomBytes } from 'crypto';

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const token = params?.token ?? '';
    const rfi = await prisma.rFI.findFirst({
      where: { externalToken: token },
      include: {
        project: { select: { projectNumber: true, projectName: true } },
      },
    });

    if (!rfi) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    if (rfi.status === 'Answered' || rfi.status === 'Closed') {
      return NextResponse.json({
        rfiNumber: rfi.rfiNumber,
        subject: rfi.subject,
        question: rfi.question,
        status: rfi.status,
        projectName: rfi.project.projectName,
        projectNumber: rfi.project.projectNumber,
        alreadyAnswered: true,
        responseText: rfi.responseText,
      });
    }

    return NextResponse.json({
      rfiNumber: rfi.rfiNumber,
      subject: rfi.subject,
      question: rfi.question,
      status: rfi.status,
      projectName: rfi.project.projectName,
      projectNumber: rfi.project.projectNumber,
      assignedTo: rfi.assignedTo,
      dueDate: rfi.dateDue,
      alreadyAnswered: false,
    });
  } catch (error: any) {
    console.error('GET /api/rfis/public/[token] error:', error);
    return NextResponse.json({ error: 'Failed to load RFI' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const token = params?.token ?? '';
    const rfi = await prisma.rFI.findFirst({
      where: { externalToken: token },
      include: { project: true },
    });

    if (!rfi) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    if (rfi.status === 'Answered' || rfi.status === 'Closed') {
      return NextResponse.json({ error: 'This RFI has already been answered' }, { status: 400 });
    }

    const body = await request.json();
    const { responseText, responseBy, costImpact, scheduleImpact } = body ?? {};

    if (!responseText?.trim()) {
      return NextResponse.json({ error: 'Response text is required' }, { status: 400 });
    }

    const responder = responseBy ? String(responseBy) : rfi.assignedTo || 'External Respondent';

    const decisionToken = rfi.decisionToken ?? randomBytes(24).toString('hex');

    const updated = await prisma.rFI.update({
      where: { id: rfi.id },
      data: {
        responseText: String(responseText),
        responseBy: responder,
        responseDate: new Date(),
        status: 'Answered',
        decisionToken,
        costImpact: costImpact || rfi.costImpact,
        scheduleImpact: scheduleImpact || rfi.scheduleImpact,
        ballInCourt: rfi.submittedBy,
        ballInCourtRole: rfi.submittedByRole || 'Project Manager',
      },
    });

    try {
      const toList = collectEmails((rfi as any).submittedByEmail, rfi.submittedBy);
      const ccList = collectEmails(
        (rfi as any).assignedToEmail,
        (rfi as any).superintendentEmail,
        (rfi as any).requestingSubEmail,
      ).filter((e) => !toList.includes(e));

      if (toList.length) {
        await sendRfiAnsweredEmail({
          companyId: rfi.project.companyId,
          to: toList,
          cc: ccList,
          rfiId: rfi.id,
          rfiNumber: rfi.rfiNumber,
          subject: rfi.subject,
          responseText: String(responseText),
          responseBy: responder,
          costImpact: String(costImpact || rfi.costImpact || 'TBD'),
          scheduleImpact: String(scheduleImpact || rfi.scheduleImpact || 'TBD'),
          closeUrl: `${appBaseUrl()}/respond/close/${decisionToken}`,
        });
      }
    } catch (emailErr) {
      console.error('External RFI response email error:', emailErr);
    }

    return NextResponse.json({ ok: true, rfiNumber: updated.rfiNumber, status: updated.status });
  } catch (error: any) {
    console.error('POST /api/rfis/public/[token] error:', error);
    return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 });
  }
}
