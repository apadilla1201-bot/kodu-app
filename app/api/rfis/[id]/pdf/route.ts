export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { htmlToPdf } from '@/lib/pdf';
import { appBaseUrl } from '@/lib/app-url';
import {
  buildRfiPdfFilename,
  buildRfiPdfHtml,
  mergeRfiPdfWithAttachments,
  RfiPdfMergeError,
} from '@/lib/rfi-pdf';
import { getSessionLocale } from '@/lib/i18n/server';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';

    const rfi = await prisma.rFI.findFirst({
      where: { id: params?.id ?? '', project: { companyId } },
      include: {
        project: true,
        attachments: true,
      },
    });

    if (!rfi) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const logoUrl = `${appBaseUrl()}/pdg_logo.png`;
    const locale = await getSessionLocale();
    const htmlContent = buildRfiPdfHtml(rfi, rfi.project, logoUrl, locale);
    const pdfBuffer = await htmlToPdf(htmlContent);

    let finalPdfBytes: Uint8Array;
    try {
      finalPdfBytes = await mergeRfiPdfWithAttachments(pdfBuffer, rfi.attachments ?? []);
    } catch (err) {
      if (err instanceof RfiPdfMergeError) {
        return NextResponse.json(
          { error: err.message, failedFiles: err.failedFiles },
          { status: 500 },
        );
      }
      throw err;
    }

    return new NextResponse(Buffer.from(finalPdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${buildRfiPdfFilename(rfi.rfiNumber, rfi.subject)}"`,
      },
    });
  } catch (error: any) {
    console.error('RFI PDF error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
