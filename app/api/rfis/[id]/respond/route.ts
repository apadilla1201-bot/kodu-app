export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveEmailAddress, sendRfiAnsweredEmail } from '@/lib/email';

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

    const updated = await prisma.rFI.update({
      where: { id: params.id },
      data: {
        responseText: String(responseText),
        responseBy: responseBy ? String(responseBy) : 'Augusto Padilla',
        responseDate: new Date(),
        status: 'Answered',
        costImpact: costImpact || rfi.costImpact,
        scheduleImpact: scheduleImpact || rfi.scheduleImpact,
      },
      include: {
        project: { select: { id: true, projectNumber: true, projectName: true } },
        attachments: true,
      },
    });

    // Send email notification for RFI response
    try {
      const recipient = resolveEmailAddress(
        notifyEmail,
        rfi.submittedBy,
        session.user?.email,
      );
      if (recipient) {
        await sendRfiAnsweredEmail({
          to: recipient,
          rfiId: rfi.id,
          rfiNumber: rfi.rfiNumber,
          subject: rfi.subject,
          responseText: String(responseText),
          responseBy: responseBy ? String(responseBy) : (session.user?.name || 'Project Manager'),
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
