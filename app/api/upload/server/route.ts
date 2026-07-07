export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { uploadBufferToStorage } from '@/lib/s3';

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Archivo muy grande (máx 25 MB)' }, { status: 413 });
    }

    const fileName = String(formData.get('fileName') || (file as File).name || `file-${Date.now()}`);
    const contentType = String(formData.get('contentType') || file.type || 'application/octet-stream');
    const isPublic = formData.get('isPublic') === 'true';

    const { cloud_storage_path } = await uploadBufferToStorage(buffer, fileName, contentType, isPublic);

    return NextResponse.json({
      cloud_storage_path,
      isPublic,
    });
  } catch (error: any) {
    console.error('Server upload error:', error);
    return NextResponse.json(
      { error: error?.message || 'No se pudo subir el archivo' },
      { status: 500 },
    );
  }
}
