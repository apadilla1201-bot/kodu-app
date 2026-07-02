export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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
    const { responseText, responseBy, costImpact, scheduleImpact, attachments } = body ?? {};

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
      const appUrl = process.env.NEXTAUTH_URL || '';
      const htmlBody = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#2E7D32;padding:16px 20px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;">RFI Answered</h2>
          </div>
          <div style="background:#f9fafb;padding:20px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
            <p><strong>RFI #:</strong> ${rfi.rfiNumber}</p>
            <p><strong>Subject:</strong> ${rfi.subject}</p>
            <p><strong>Responded By:</strong> ${responseBy || 'Augusto Padilla'}</p>
            <div style="background:white;padding:15px;border-radius:4px;border-left:4px solid #2E7D32;margin:12px 0;">
              <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;">Response</p>
              <p style="margin:4px 0 0 0;">${String(responseText).substring(0, 500)}</p>
            </div>
            <p><strong>Cost Impact:</strong> ${costImpact || rfi.costImpact}</p>
            <p><strong>Schedule Impact:</strong> ${scheduleImpact || rfi.scheduleImpact}</p>
          </div>
        </div>
      `;
      await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          app_id: process.env.WEB_APP_ID,
          notification_id: process.env.NOTIF_ID_RFI_ANSWERED,
          subject: `RFI ${rfi.rfiNumber} Answered — ${rfi.subject.substring(0, 60)}`,
          body: htmlBody,
          is_html: true,
          recipient_email: 'apadilla1201@gmail.com',
          sender_email: `noreply@${new URL(appUrl).hostname}`,
          sender_alias: 'PDG RFI Manager',
        }),
      });
    } catch (emailErr) {
      console.error('RFI response notification error:', emailErr);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('POST /api/rfis/[id]/respond error:', error);
    return NextResponse.json({ error: 'Failed to respond to RFI' }, { status: 500 });
  }
}
