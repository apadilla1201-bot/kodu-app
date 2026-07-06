/**
 * Helpers de subida/descarga de archivos (cliente).
 * Usa almacenamiento local cuando AWS no está configurado.
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

export async function uploadFileToStorage(file: File, isPublic = false): Promise<UploadedFile> {
  const contentType = resolveContentType(file);

  const presignRes = await fetch('/api/upload/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, contentType, isPublic }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) {
    throw new Error(presignData?.error ?? 'No se pudo preparar la subida del archivo');
  }

  const uploadUrl = presignData.uploadUrl ?? '';
  if (!uploadUrl) {
    throw new Error('No se recibió URL de subida');
  }

  const uploadHeaders: Record<string, string> = { 'Content-Type': contentType };
  try {
    const signedHeaders = new URL(uploadUrl).searchParams.get('X-Amz-SignedHeaders') ?? '';
    if (signedHeaders.includes('content-disposition')) {
      uploadHeaders['Content-Disposition'] = 'attachment';
    }
  } catch {
    // URL local relativa o sin parámetros S3 — no requiere Content-Disposition
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: file,
    credentials: 'include',
  });
  if (!uploadRes.ok) {
    throw new Error(`No se pudo guardar el archivo: ${file.name}`);
  }

  return {
    cloud_storage_path: presignData.cloud_storage_path ?? '',
    isPublic,
  };
}

export async function getStorageDownloadUrl(storagePath: string): Promise<string> {
  const res = await fetch(`/api/upload/presigned?path=${encodeURIComponent(storagePath)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? 'No se pudo obtener el enlace de descarga');
  }
  const url = data?.url ?? data?.downloadUrl ?? '';
  if (!url) throw new Error('Enlace de descarga no disponible');
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
