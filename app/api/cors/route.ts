export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { collectEmails, resolveEmailAddress, sendCorApprovalRequestEmail, sendItemSentConfirmationEmail } from '@/lib/email';
import { appBaseUrl } from '@/lib/app-url';
import { randomBytes } from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';
    const body = await request.json();
    const {
      projectId, description, subcontractor, csiCode, date,
      lineItems, marketComparisons, marketAnalysisNotes,
      reasonForChange, reasonsParticular, subPdfCloudPath, subPdfIsPublic,
      ownerName, ownerEmail, sendForApproval,
    } = body ?? {};

    if (!projectId || !description) {
      return NextResponse.json({ error: 'Project and description are required' }, { status: 400 });
    }

    // Verify the project belongs to the caller's company (multi-tenant access,
    // consistent with the project list and the rest of the API which filter by
    // companyId). Previously this checked userId, so a user could see a company
    // project but got "Project not found" when creating a COR on it.
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      include: { changeOrders: { orderBy: { sequence: 'desc' }, take: 1, select: { sequence: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const nextSeq = ((project?.changeOrders?.[0]?.sequence ?? 0) + 1);
    const corNumber = `${project?.projectNumber ?? '000'}-${String(nextSeq).padStart(3, '0')}`;

    // Calculate totals
    const safeLineItems = lineItems ?? [];
    const subtotalCalc = safeLineItems.reduce((s: number, li: any) => s + (parseFloat(String(li?.total ?? 0)) || 0), 0);
    const materialTotal = safeLineItems.filter((li: any) => li?.isMaterial !== false).reduce((s: number, li: any) => s + (parseFloat(String(li?.total ?? 0)) || 0), 0);
    const salesTaxCalc = materialTotal * 0.07;
    const supplierTotal = subtotalCalc + salesTaxCalc;
    const opCalc = supplierTotal * 0.06;
    const glCalc = supplierTotal * 0.015;
    const totalCalc = supplierTotal + opCalc + glCalc;

    const externalToken = randomBytes(24).toString('hex');
    const approverEmail = resolveEmailAddress(ownerEmail);

    const changeOrder = await prisma.changeOrder.create({
      data: {
        projectId,
        corNumber,
        sequence: nextSeq,
        date: date ? new Date(date) : new Date(),
        description: String(description ?? ''),
        subcontractor: subcontractor ? String(subcontractor) : null,
        csiCode: csiCode ? String(csiCode) : null,
        ownerName: ownerName ? String(ownerName) : null,
        ownerEmail: approverEmail,
        externalToken,
        subtotal: subtotalCalc,
        overheadProfit: opCalc,
        generalLiability: glCalc,
        salesTax: salesTaxCalc,
        totalAmount: totalCalc,
        reasonForChange: reasonForChange ? String(reasonForChange) : null,
        reasonsParticular: reasonsParticular ? String(reasonsParticular) : null,
        marketAnalysisNotes: marketAnalysisNotes ? String(marketAnalysisNotes) : null,
        subPdfCloudPath: subPdfCloudPath ? String(subPdfCloudPath) : null,
        subPdfIsPublic: subPdfIsPublic ?? false,
        status: 'Pending',
        lineItems: {
          create: safeLineItems.map((li: any) => ({
            description: String(li?.description ?? ''),
            productCode: li?.productCode ? String(li.productCode) : null,
            quantity: parseFloat(String(li?.quantity ?? 1)) || 1,
            unit: String(li?.unit ?? 'EA'),
            unitPrice: parseFloat(String(li?.unitPrice ?? 0)) || 0,
            total: parseFloat(String(li?.total ?? 0)) || 0,
            isMaterial: li?.isMaterial !== false,
          })),
        },
        marketComparisons: {
          create: (marketComparisons ?? []).map((mc: any) => ({
            itemDescription: String(mc?.itemDescription ?? ''),
            subQuote: parseFloat(String(mc?.subQuote ?? 0)) || 0,
            marketAverage: parseFloat(String(mc?.marketAverage ?? 0)) || 0,
            variancePercent: parseFloat(String(mc?.variancePercent ?? 0)) || 0,
            assessment: mc?.assessment ? String(mc.assessment) : null,
            source: mc?.source ? String(mc.source) : null,
          })),
        },
      },
      include: { lineItems: true, marketComparisons: true },
    });

    // Email al aprobador (Owner) con enlace seguro para aprobar sin login.
    // Se envía si hay ownerEmail, o si el wizard marcó "send for approval" (cae al correo del creador).
    try {
      const creatorEmail = resolveEmailAddress(session.user?.email);
      const toList = collectEmails(approverEmail);
      const primaryTo = toList.length ? toList : sendForApproval ? collectEmails(creatorEmail) : [];
      const ccList = collectEmails(creatorEmail).filter((e) => !primaryTo.includes(e));

      if (primaryTo.length) {
        await sendCorApprovalRequestEmail({
          to: primaryTo,
          cc: ccList,
          replyTo: creatorEmail || undefined,
          corId: changeOrder.id,
          corNumber: changeOrder.corNumber,
          description: changeOrder.description,
          projectName: project.projectName,
          projectNumber: project.projectNumber,
          subcontractor: changeOrder.subcontractor,
          totalAmount: changeOrder.totalAmount,
          ownerName: ownerName ? String(ownerName) : null,
          submittedBy: session.user?.name || 'Project Manager',
          externalApproveUrl: `${appBaseUrl()}/respond/cor/${externalToken}`,
        });
      }
    } catch (emailErr) {
      console.error('COR approval request email error:', emailErr);
    }

    // Confirmación al CREADOR cuando el COR se envió a aprobación
    try {
      if (approverEmail || sendForApproval) {
        const creatorTo = collectEmails(resolveEmailAddress(session.user?.email));
        const approverName = ownerName ? String(ownerName) : approverEmail ? String(approverEmail) : 'Approver';
        if (creatorTo.length) {
          await sendItemSentConfirmationEmail({
            to: creatorTo,
            kind: 'Change Order',
            number: changeOrder.corNumber,
            title: changeOrder.description,
            projectName: project.projectName,
            assignedTo: approverName,
            itemUrl: `${appBaseUrl()}/dashboard/cors/${changeOrder.id}`,
          });
        }
      }
    } catch (emailErr) {
      console.error('COR creator confirmation email error:', emailErr);
    }

    return NextResponse.json(changeOrder, { status: 201 });
  } catch (error: any) {
    console.error('Create COR error:', error);
    return NextResponse.json({ error: 'Failed to create change order' }, { status: 500 });
  }
}
