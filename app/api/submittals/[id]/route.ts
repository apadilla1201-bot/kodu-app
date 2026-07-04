export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { collectEmails, resolveEmailAddress, sendSubmittalEmail } from '@/lib/email';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const submittal = await prisma.submittal.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
      include: { project: true, attachments: true },
    });

    if (!submittal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(submittal);
  } catch (error: any) {
    console.error('GET /api/submittals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch submittal' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.submittal.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    const fields = [
      'title', 'description', 'submittalType', 'specSection', 'subcontractor',
      'priority', 'status', 'submittedBy', 'reviewedBy', 'notes',
      'assignedTo', 'assignedToRole', 'ballInCourt', 'ballInCourtRole',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.requiredDate !== undefined) {
      data.requiredDate = body.requiredDate ? new Date(body.requiredDate) : null;
    }
    if (body.status === 'Submitted' && existing.status === 'Draft') {
      data.submittedDate = new Date();
      data.ballInCourt = (body.assignedTo as string) || existing.assignedTo || 'Architect';
      data.ballInCourtRole = (body.assignedToRole as string) || existing.assignedToRole || 'Architect';
    }
    if (body.status === 'Approved' || body.status === 'Revise and Resubmit') {
      data.reviewedDate = new Date();
      data.reviewedBy = body.reviewedBy ?? session.user?.name ?? null;
      data.ballInCourt = existing.subcontractor || existing.submittedBy || 'Subcontractor';
      data.ballInCourtRole = body.status === 'Approved' ? 'Subcontractor' : 'Subcontractor';
    }
    if (body.status === 'Rejected') {
      data.reviewedDate = new Date();
      data.reviewedBy = body.reviewedBy ?? session.user?.name ?? null;
      data.ballInCourt = existing.subcontractor || existing.submittedBy;
      data.ballInCourtRole = 'Subcontractor';
    }
    if (body.status === 'Under Review' && existing.status === 'Submitted') {
      data.reviewedBy = body.reviewedBy ?? session.user?.name ?? null;
      data.ballInCourt = body.reviewedBy ?? session.user?.name ?? existing.assignedTo;
      data.ballInCourtRole = 'Reviewer';
    }

    const updated = await prisma.submittal.update({
      where: { id: params.id },
      data,
      include: { project: true, attachments: true },
    });

    const statusChanged = body.status && body.status !== existing.status;
    if (statusChanged) {
      const eventMap: Record<string, 'submitted' | 'under_review' | 'approved' | 'revise' | 'rejected'> = {
        Submitted: 'submitted',
        'Under Review': 'under_review',
        Approved: 'approved',
        'Revise and Resubmit': 'revise',
        Rejected: 'rejected',
      };
      const event = eventMap[body.status];
      if (event) {
        try {
          const sub = updated as typeof updated & {
            submittedByEmail?: string | null;
            assignedToEmail?: string | null;
            reviewerEmail?: string | null;
            subcontractorEmail?: string | null;
            superintendentEmail?: string | null;
          };
          const toList =
            event === 'submitted' || event === 'under_review'
              ? collectEmails(sub.assignedToEmail, sub.reviewerEmail)
              : collectEmails(sub.subcontractorEmail, sub.submittedByEmail, existing.submittedBy);
          const ccList = collectEmails(
            sub.submittedByEmail,
            sub.superintendentEmail,
            session.user?.email,
          ).filter((e) => !toList.includes(e));
          const primaryTo = toList.length ? toList : collectEmails(sub.submittedByEmail, session.user?.email);

          if (primaryTo.length) {
            await sendSubmittalEmail({
              to: primaryTo,
              cc: ccList,
              replyTo: sub.submittedByEmail || undefined,
              event,
              submittalId: updated.id,
              submittalNumber: updated.submittalNumber,
              title: updated.title,
              projectName: updated.project.projectName,
              projectNumber: updated.project.projectNumber,
              subcontractor: updated.subcontractor,
              submittedBy: updated.submittedBy,
              reviewedBy: updated.reviewedBy,
              assignedTo: updated.assignedTo,
              ballInCourt: updated.ballInCourt,
            });
          }
        } catch (emailErr) {
          console.error('Submittal status email error:', emailErr);
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/submittals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update submittal' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const existing = await prisma.submittal.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.submittal.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/submittals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete submittal' }, { status: 500 });
  }
}
