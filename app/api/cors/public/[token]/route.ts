export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { collectEmails, sendCorDecisionEmail, sendCorDecidedNoticeEmail } from '@/lib/email';

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const token = params?.token ?? '';
    const cor = await prisma.changeOrder.findFirst({
      where: { externalToken: token },
      include: {
        project: { select: { projectNumber: true, projectName: true } },
        lineItems: { select: { description: true, quantity: true, unit: true, unitPrice: true, total: true } },
      },
    });

    if (!cor) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    return NextResponse.json({
      corNumber: cor.corNumber,
      description: cor.description,
      reasonForChange: cor.reasonForChange,
      subcontractor: cor.subcontractor,
      status: cor.status,
      subtotal: cor.subtotal,
      salesTax: cor.salesTax,
      overheadProfit: cor.overheadProfit,
      generalLiability: cor.generalLiability,
      totalAmount: cor.totalAmount,
      projectName: cor.project.projectName,
      projectNumber: cor.project.projectNumber,
      ownerName: cor.ownerName,
      lineItems: cor.lineItems,
      alreadyDecided: cor.status === 'Approved' || cor.status === 'Rejected',
      decidedBy: cor.decidedBy,
    });
  } catch (error: any) {
    console.error('GET /api/cors/public/[token] error:', error);
    return NextResponse.json({ error: 'Failed to load change order' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const token = params?.token ?? '';
    const cor = await prisma.changeOrder.findFirst({
      where: { externalToken: token },
      include: { project: true },
    });

    if (!cor) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    if (cor.status === 'Approved' || cor.status === 'Rejected') {
      return NextResponse.json({ error: `This change order is already ${cor.status.toLowerCase()}` }, { status: 400 });
    }

    const body = await request.json();
    const { decision, decidedBy } = body ?? {};

    if (decision !== 'Approved' && decision !== 'Rejected') {
      return NextResponse.json({ error: 'Decision must be Approved or Rejected' }, { status: 400 });
    }

    const decider = decidedBy?.trim() ? String(decidedBy) : cor.ownerName || 'External Approver';

    const updated = await prisma.changeOrder.update({
      where: { id: cor.id },
      data: {
        status: decision,
        decidedBy: decider,
        approvalDate: decision === 'Approved' ? new Date() : null,
      },
    });

    // Notify the CREATOR that the owner decided ("your COR was Approved/Rejected")
    try {
      const teamEmails = collectEmails((cor as any).ownerEmail).filter((e) => e !== decider);
      const creator = cor.project?.userId
        ? await prisma.user.findUnique({ where: { id: cor.project.userId }, select: { email: true } })
        : null;
      const notifyTo = collectEmails(creator?.email);
      const notifyCc = teamEmails.filter((e) => !notifyTo.includes(e));

      if (notifyTo.length) {
        await sendCorDecidedNoticeEmail({
          companyId: cor.project.companyId,
          to: notifyTo,
          cc: notifyCc,
          corId: cor.id,
          corNumber: cor.corNumber,
          description: cor.description,
          projectName: cor.project.projectName,
          totalAmount: cor.totalAmount,
          decision,
          decidedBy: decider,
        });
      }
    } catch (emailErr) {
      console.error('COR decision email error:', emailErr);
    }

    return NextResponse.json({ ok: true, corNumber: updated.corNumber, status: updated.status });
  } catch (error: any) {
    console.error('POST /api/cors/public/[token] error:', error);
    return NextResponse.json({ error: 'Failed to submit decision' }, { status: 500 });
  }
}
