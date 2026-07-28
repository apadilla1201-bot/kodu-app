export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectEmails, sendSubmittalRespondedEmail } from '@/lib/email';
import { appBaseUrl } from '@/lib/app-url';
import { randomBytes } from 'crypto';

const CLOSED_STATUSES = ['Approved', 'Rejected', 'Revise & Resubmit', 'Closed'];

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const token = params?.token ?? '';
    const submittal = await prisma.submittal.findFirst({
      where: { externalToken: token },
      include: {
        project: { select: { projectNumber: true, projectName: true } },
        attachments: { where: { isPublic: true }, select: { fileName: true, fileType: true, cloudStoragePath: true } },
      },
    });

    if (!submittal) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const closed = CLOSED_STATUSES.includes(submittal.status);
    return NextResponse.json({
      submittalNumber: submittal.submittalNumber,
      title: submittal.title,
      description: submittal.description,
      submittalType: submittal.submittalType,
      specSection: submittal.specSection,
      status: submittal.status,
      projectName: submittal.project.projectName,
      projectNumber: submittal.project.projectNumber,
      assignedTo: submittal.assignedTo,
      requiredDate: submittal.requiredDate,
      alreadyAnswered: closed || Boolean(submittal.responseText),
      responseText: submittal.responseText,
      attachments: submittal.attachments,
    });
  } catch (error: any) {
    console.error('GET /api/submittals/public/[token] error:', error);
    return NextResponse.json({ error: 'Failed to load submittal' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const token = params?.token ?? '';
    const submittal = await prisma.submittal.findFirst({
      where: { externalToken: token },
      include: { project: true },
    });

    if (!submittal) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    if (CLOSED_STATUSES.includes(submittal.status)) {
      return NextResponse.json({ error: 'This submittal is already closed' }, { status: 400 });
    }

    const body = await request.json();
    const { responseText, responseBy } = body ?? {};

    if (!responseText?.trim()) {
      return NextResponse.json({ error: 'Response text is required' }, { status: 400 });
    }

    const responder = responseBy ? String(responseBy) : submittal.assignedTo || 'External Respondent';

    const decisionToken = submittal.decisionToken ?? randomBytes(24).toString('hex');

    await prisma.submittal.update({
      where: { id: submittal.id },
      data: {
        responseText: String(responseText),
        responseBy: responder,
        responseDate: new Date(),
        status: 'Under Review',
        decisionToken,
        ballInCourt: submittal.submittedBy,
        ballInCourtRole: 'Project Manager',
      },
    });

    try {
      const toList = collectEmails(submittal.submittedByEmail);
      const ccList = collectEmails(
        submittal.assignedToEmail,
        submittal.reviewerEmail,
        submittal.superintendentEmail,
        submittal.subcontractorEmail,
      ).filter((e) => !toList.includes(e));

      if (toList.length) {
        await sendSubmittalRespondedEmail({
          to: toList,
          cc: ccList,
          submittalId: submittal.id,
          submittalNumber: submittal.submittalNumber,
          title: submittal.title,
          projectName: submittal.project.projectName,
          responseText: String(responseText),
          responseBy: responder,
          closeUrl: `${appBaseUrl()}/respond/close/${decisionToken}`,
        });
      }
    } catch (emailErr) {
      console.error('External submittal response email error:', emailErr);
    }

    return NextResponse.json({ ok: true, submittalNumber: submittal.submittalNumber });
  } catch (error: any) {
    console.error('POST /api/submittals/public/[token] error:', error);
    return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 });
  }
}
