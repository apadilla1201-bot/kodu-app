export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

// Límite generoso para propuestas escaneadas de subs (PDF pesados).
const MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/octet-stream',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

/**
 * Emite tokens para subida directa del navegador a Vercel Blob.
 * Evita el límite de ~4.5 MB del body de las funciones serverless,
 * que hacía fallar la subida de PDFs reales (propuestas de subs).
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    // El cliente cae a la subida por servidor (dev local / S3).
    return NextResponse.json({ error: 'blob-not-configured' }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        addRandomSuffix: true,
        maximumSizeInBytes: MAX_BYTES,
        tokenPayload: JSON.stringify({ uid: (session.user as any).id ?? '' }),
      }),
      onUploadCompleted: async () => {
        // Sin acción extra: el cliente guarda cloud_storage_path como siempre.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error('Blob token error:', error);
    return NextResponse.json(
      { error: error?.message || 'blob-token-failed' },
      { status: 500 },
    );
  }
}
