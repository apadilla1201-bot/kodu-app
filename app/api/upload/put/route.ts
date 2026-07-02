export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { saveLocalFile } from '@/lib/storage';

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key || !key.startsWith('uploads/')) {
      return NextResponse.json({ error: 'Invalid upload key' }, { status: 400 });
    }

    const body = Buffer.from(await request.arrayBuffer());
    if (body.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    await saveLocalFile(key, body);
    return new NextResponse(null, { status: 200 });
  } catch (error: any) {
    console.error('Local upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
