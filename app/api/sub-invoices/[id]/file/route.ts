export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';

// GET → redirige a la URL firmada del PDF. ?which=stamped (default) | original
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const companyId = (session.user as any)?.companyId ?? '';

    const invoice = await prisma.subInvoice.findFirst({
      where: { id: params.id, project: { companyId } },
    });
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const which = searchParams.get('which') ?? 'stamped';
    const path = which === 'original' ? invoice.fileUrl : (invoice.stampedFileUrl ?? invoice.fileUrl);
    if (!path) return NextResponse.json({ error: 'No file' }, { status: 404 });

    const url = await getFileUrl(path, true, { inline: true });
    return NextResponse.redirect(url);
  } catch (err) {
    console.error('sub-invoices file error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
