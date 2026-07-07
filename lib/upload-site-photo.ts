/**
 * Upload a site photo through our API (server → S3). Reliable on mobile Safari.
 */
export async function uploadSitePhoto(
  projectId: string,
  file: File,
  meta?: { caption?: string | null; tag?: string; area?: string | null; trade?: string | null },
): Promise<Record<string, unknown>> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('fileName', file.name);
  fd.append('contentType', file.type || 'image/jpeg');
  if (meta?.caption) fd.append('caption', meta.caption);
  if (meta?.tag) fd.append('tag', meta.tag);
  if (meta?.area) fd.append('area', meta.area);
  if (meta?.trade) fd.append('trade', meta.trade);

  const res = await fetch(`/api/projects/${projectId}/photos/upload`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Error al subir (${res.status})`);
  }
  return data;
}
