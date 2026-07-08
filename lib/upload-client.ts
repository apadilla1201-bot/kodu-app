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

export async function uploadFileToStorage(file: File, isPublic = false): Promise<UploadedFile> {
  const contentType = resolveContentType(file);
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
    throw new Error(data?.error ?? 'Failed to upload file');
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
