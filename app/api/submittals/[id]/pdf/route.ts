export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getSessionLocale } from '@/lib/i18n/server';
import { buildSubmittalReportPdf } from '@/lib/submittal-report';

// Reporte del submittal: portada con formato koduPM + anexos del sub
// mergeados en un solo PDF (mismo patrón que los COR).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companyId = (session.user as any)?.companyId ?? '';
    const locale = await getSessionLocale();

    const report = await buildSubmittalReportPdf(params?.id ?? '', companyId, locale);
    if (!report) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(Buffer.from(report.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.fileName}"`,
        'Content-Length': String(report.bytes.length),
      },
    });
  } catch (error: any) {
    console.error('GET /api/submittals/[id]/pdf error:', error);
    return NextResponse.json({ error: 'Failed to generate submittal PDF' }, { status: 500 });
  }
}
