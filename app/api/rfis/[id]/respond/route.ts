export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { collectEmails, resolveEmailAddress, sendRfiAnsweredEmail } from '@/lib/email';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const rfi = await prisma.rFI.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
      include: { project: true },
    });

    if (!rfi) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { responseText, responseBy, costImpact, scheduleImpact, attachments, notifyEmail } = body ?? {};

    if (!responseText) {
      return NextResponse.json({ error: 'Response text is required' }, { status: 400 });
    }

    // Create response attachments if any
    if (attachments && attachments.length > 0) {
      await prisma.rFIAttachment.createMany({
        data: attachments.map((att: any) => ({
          rfiId: params.id,
          fileName: att.fileName,
          fileType: att.fileType || null,
          cloudStoragePath: att.cloudStoragePath,
          isPublic: att.isPublic || false,
          attachmentType: 'response',
        })),
      });
    }

    const responder = responseBy ? String(responseBy) : (session.user?.name || 'Respondent');

    const updated = await prisma.rFI.update({
      where: { id: params.id },
      data: {
        responseText: String(responseText),
        responseBy: responder,
        responseDate: new Date(),
        status: 'Answered',
        costImpact: costImpact || rfi.costImpact,
        scheduleImpact: scheduleImpact || rfi.scheduleImpact,
        // Ball in court returns to PM after response
        ballInCourt: rfi.submittedBy,
        ballInCourtRole: rfi.submittedByRole || 'Project Manager',
      },
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        attachments: true,
      },
    });

    // Notify PM (primary) + CC assignee, super, requesting sub
    try {
      const toList = collectEmails(
        notifyEmail,
        (rfi as any).submittedByEmail,
        rfi.submittedBy,
        session.user?.email,
      );
      const ccList = collectEmails(
        (rfi as any).assignedToEmail,
        (rfi as any).superintendentEmail,
        (rfi as any).requestingSubEmail,
      ).filter((e) => !toList.includes(e));

      if (toList.length) {
        await sendRfiAnsweredEmail({
          to: toList,
          cc: ccList,
          rfiId: rfi.id,
          rfiNumber: rfi.rfiNumber,
          subject: rfi.subject,
          responseText: String(responseText),
          responseBy: responder,
          costImpact: String(costImpact || rfi.costImpact || 'TBD'),
          scheduleImpact: String(scheduleImpact || rfi.scheduleImpact || 'TBD'),
        });
      }
    } catch (emailErr) {
      console.error('RFI response notification error:', emailErr);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('POST /api/rfis/[id]/respond error:', error);
    return NextResponse.json({ error: 'Failed to respond to RFI' }, { status: 500 });
  }
}
