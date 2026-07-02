export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { guessMimeType, readLocalFile } from '@/lib/storage';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    if (!filePath || !filePath.startsWith('uploads/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const buffer = await readLocalFile(filePath);
    const fileName = filePath.split('/').pop() ?? 'file';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': guessMimeType(fileName),
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Local file download error:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
