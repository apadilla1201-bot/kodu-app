/**
 * Helpers de subida/descarga de archivos (cliente).
 * Usa subida por servidor (compatible con Vercel Blob, S3 y local).
 */

export type UploadedFile = {
  cloud_storage_path: string;
  isPublic: boolean;
};

function resolveContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    pdf: 'application/pdf',
  };
  return byExt[ext] ?? 'application/octet-stream';
}

export function downloadBlobFile(blob: Blob, fileName: string, openInNewTab = false): void {
  const url = URL.createObjectURL(blob);
  if (openInNewTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Sube un archivo al storage.
 * 1) Intenta subida directa a Vercel Blob (sin el límite de ~4.5 MB de las
 *    funciones serverless, que tumbaba PDFs reales de propuestas de subs).
 * 2) Si Blob no está configurado (dev local / S3), cae a la subida por servidor.
 */
export async function uploadFileToStorage(file: File, isPublic = false): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File too large (max 50 MB)');
  }

  const contentType = resolveContentType(file);

  // 1) Subida directa a Vercel Blob
  let blobError: Error | null = null;
  try {
    const { upload } = await import('@vercel/blob/client');
    const safeName = (file.name || 'file').replace(/[/\\]/g, '_');
    const blob = await upload(`uploads/${Date.now()}-${safeName}`, file, {
      access: 'public',
      handleUploadUrl: '/api/upload/blob-token',
      contentType,
      multipart: file.size > 10 * 1024 * 1024,
    });
    return { cloud_storage_path: `vercel-blob:${blob.url}`, isPublic };
  } catch (error: any) {
    const msg = String(error?.message ?? '');
    if (msg.includes('blob-not-configured')) {
      blobError = null; // backend sin Blob: ir directo al fallback
    } else {
      blobError = error instanceof Error ? error : new Error(msg);
    }
  }

  // 2) Fallback: subida por servidor (local/S3; sujeta al límite de plataforma)
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('fileName', file.name);
  fd.append('contentType', contentType);
  fd.append('isPublic', isPublic ? 'true' : 'false');

  const res = await fetch('/api/upload/server', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Si la subida directa también falló, su error suele ser más informativo.
    throw blobError ?? new Error(data?.error ?? 'Failed to upload file');
  }

  return {
    cloud_storage_path: data.cloud_storage_path ?? '',
    isPublic: data.isPublic ?? isPublic,
  };
}

export async function getStorageDownloadUrl(storagePath: string): Promise<string> {
  const res = await fetch(`/api/upload/presigned?path=${encodeURIComponent(storagePath)}`, {
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? 'Failed to get download link');
  }
  const url = data?.url ?? data?.downloadUrl ?? '';
  if (!url) throw new Error('Download link unavailable');
  return url;
}

export async function downloadStorageFile(storagePath: string, fileName: string): Promise<void> {
  const url = await getStorageDownloadUrl(storagePath);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function fetchRfiPdf(rfiId: string): Promise<Blob> {
  const res = await fetch(`/api/rfis/${rfiId}/pdf`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'Failed to generate PDF');
  }
  return res.blob();
}
