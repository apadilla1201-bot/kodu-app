import { del, put } from '@vercel/blob';

const PREFIX = 'vercel-blob:';

export function isBlobStoragePath(storagePath: string): boolean {
  return storagePath.startsWith(PREFIX);
}

export function blobPublicUrl(storagePath: string): string {
  return storagePath.slice(PREFIX.length);
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function uploadBufferToBlob(
  body: Buffer,
  fileName: string,
  contentType: string,
): Promise<{ cloud_storage_path: string }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('Almacenamiento Blob no configurado (BLOB_READ_WRITE_TOKEN)');
  }

  const safeName = (fileName ?? 'photo.jpg').replace(/[/\\]/g, '_');
  const pathname = `site-photos/${Date.now()}-${safeName}`;

  const result = await put(pathname, body, {
    access: 'public',
    contentType: contentType || 'image/jpeg',
    token,
  });

  return { cloud_storage_path: `${PREFIX}${result.url}` };
}

export async function deleteBlobFile(storagePath: string): Promise<void> {
  if (!isBlobStoragePath(storagePath)) return;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  try {
    await del(blobPublicUrl(storagePath), { token });
  } catch {
    // ignore missing blobs
  }
}
