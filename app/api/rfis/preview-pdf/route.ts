export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import { appBaseUrl } from '@/lib/app-url';
import { buildRfiPdfFilename, buildRfiPdfHtml, mergeRfiPdfWithAttachments, RfiPdfMergeError } from '@/lib/rfi-pdf';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const body = await request.json();
    const {
      projectId,
      subject,
      question,
      discipline,
      drawingReference,
      specReference,
      priority,
      submittedBy,
      submittedByRole,
      assignedTo,
      assignedToRole,
      daysToRespond,
      costImpact,
      scheduleImpact,
      notes,
      rfiNumberPreview,
      attachments,
    } = body ?? {};

    if (!projectId || !subject || !question) {
      return NextResponse.json({ error: 'Project, subject and question are required' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const days = daysToRespond ? parseInt(String(daysToRespond), 10) : 7;
    const dateSubmitted = new Date();
    const dateDue = new Date();
    dateDue.setDate(dateDue.getDate() + days);

    const rfiNumber =
      rfiNumberPreview != null && String(rfiNumberPreview).trim() !== ''
        ? String(rfiNumberPreview)
        : `${project.projectNumber}-PREVIEW`;

    const attachmentRows = Array.isArray(attachments)
      ? attachments
          .filter((a: any) => a?.cloudStoragePath)
          .map((a: any) => ({
            fileName: String(a.fileName ?? 'attachment'),
            fileType: a.fileType ? String(a.fileType) : null,
            cloudStoragePath: String(a.cloudStoragePath),
            attachmentType: a.attachmentType ? String(a.attachmentType) : 'question',
          }))
      : [];

    const mockRfi = {
      rfiNumber,
      subject: String(subject),
      question: String(question),
      discipline: discipline ? String(discipline) : null,
      drawingReference: drawingReference ? String(drawingReference) : null,
      specReference: specReference ? String(specReference) : null,
      priority: priority || 'Normal',
      status: 'Open',
      submittedBy: submittedBy ? String(submittedBy) : (session.user?.name || 'Project Manager'),
      submittedByRole: submittedByRole ? String(submittedByRole) : null,
      assignedTo: assignedTo ? String(assignedTo) : '',
      assignedToRole: assignedToRole ? String(assignedToRole) : null,
      dateSubmitted,
      dateDue,
      costImpact: costImpact ? String(costImpact) : 'TBD',
      scheduleImpact: scheduleImpact ? String(scheduleImpact) : 'TBD',
      notes: notes ? String(notes) : null,
      attachments: attachmentRows,
    };

    const logoUrl = `${appBaseUrl()}/pdg_logo.png`;
    const htmlContent = buildRfiPdfHtml(mockRfi, project, logoUrl);
    const pdfBuffer = await htmlToPdf(htmlContent);

    let finalPdfBytes: Uint8Array;
    try {
      finalPdfBytes = await mergeRfiPdfWithAttachments(pdfBuffer, attachmentRows);
    } catch (err) {
      if (err instanceof RfiPdfMergeError) {
        return NextResponse.json(
          {
            error:
              'No se pudo anexar el PDF del subcontratista al final. ' +
              'Vuelve a subir el anexo PDF y genera de nuevo.',
            failedFiles: err.failedFiles,
          },
          { status: 500 },
        );
      }
      throw err;
    }

    return new NextResponse(Buffer.from(finalPdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${buildRfiPdfFilename(rfiNumber, mockRfi.subject)}"`,
      },
    });
  } catch (error: any) {
    console.error('RFI preview PDF error:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview PDF', details: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
