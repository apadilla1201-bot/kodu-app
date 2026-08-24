/**
 * Upload a site photo through our API (server → S3). Reliable on mobile Safari.
 */
export async function uploadSitePhoto(
  projectId: string,
  file: File,
  meta?: { caption?: string | null; tag?: string; area?: string | null; trade?: string | null },
  onDebug?: (msg: string) => void,
): Promise<Record<string, unknown>> {
  const log = (msg: string) => {
    if (onDebug) onDebug(msg);
    // eslint-disable-next-line no-console
    console.log(msg);
  };

  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('fileName', file.name);
  fd.append('contentType', file.type || 'image/jpeg');
  if (meta?.caption) fd.append('caption', meta.caption);
  if (meta?.tag) fd.append('tag', meta.tag);
  if (meta?.area) fd.append('area', meta.area);
  if (meta?.trade) fd.append('trade', meta.trade);

  log(`[DEBUG uploadSitePhoto] POST /api/projects/${projectId}/photos/upload fileName=${file.name} size=${file.size} type=${file.type}`);

  const res = await fetch(`/api/projects/${projectId}/photos/upload`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  log(`[DEBUG uploadSitePhoto] response status=${res.status} ok=${res.ok}`);

  if (!res.ok) {
    throw new Error(data?.error || `Error al subir (${res.status})`);
  }
  return data;
}
