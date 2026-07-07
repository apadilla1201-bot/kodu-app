/** Site Photo / jobsite gallery helpers */

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'tif',
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  if (i < 1 || i === name.length - 1) return '';
  return name.slice(i + 1).toLowerCase();
}

/** iOS gallery picks often omit file.type — accept by MIME or extension. */
export function isImageFile(file: File): boolean {
  if (file.type?.startsWith('image/')) return true;
  const ext = fileExtension(file.name);
  if (ext && IMAGE_EXTENSIONS.has(ext)) return true;
  // Gallery picker (accept=image/*) often sends empty type and no extension on iOS.
  if (!file.type || file.type === 'application/octet-stream') {
    if (!ext) return true;
  }
  return false;
}

export function resolveImageContentType(file: File): string {
  if (file.type?.startsWith('image/')) return file.type;
  const ext = fileExtension(file.name);
  return EXT_TO_MIME[ext] ?? 'image/jpeg';
}

export function isHeicFile(file: File): boolean {
  const ext = fileExtension(file.name);
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    ext === 'heic' ||
    ext === 'heif'
  );
}

export const PHOTO_TAGS = [
  { id: 'progress', label: 'Progress', labelEs: 'Progreso', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'issue', label: 'Issue', labelEs: 'Issue / Problema', color: 'bg-red-100 text-red-800' },
  { id: 'safety', label: 'Safety', labelEs: 'Seguridad', color: 'bg-amber-100 text-amber-800' },
  { id: 'delivery', label: 'Delivery', labelEs: 'Entrega', color: 'bg-blue-100 text-blue-800' },
  { id: 'other', label: 'Other', labelEs: 'Otro', color: 'bg-gray-100 text-gray-700' },
] as const;

/** Quick-pick ubicaciones comunes en obra */
export const AREA_PRESETS = [
  'Level 1', 'Level 2', 'Level 3', 'Roof', 'Exterior', 'Parking', 'Site', 'Grid A', 'Grid B', 'Grid C',
] as const;

/** Oficios frecuentes */
export const TRADE_PRESETS = [
  'Concrete', 'Steel', 'Framing', 'Electrical', 'Plumbing', 'HVAC', 'Drywall', 'Finishes', 'Sitework',
] as const;

export type PhotoTagId = (typeof PHOTO_TAGS)[number]['id'];

export function photoTagLabel(tag: string): string {
  return PHOTO_TAGS.find((t) => t.id === tag)?.labelEs ?? PHOTO_TAGS.find((t) => t.id === tag)?.label ?? tag;
}

export function photoTagStyle(tag: string): string {
  return PHOTO_TAGS.find((t) => t.id === tag)?.color ?? 'bg-gray-100 text-gray-700';
}

/** Línea corta para tarjetas: ubicación + oficio */
export function photoLocationLine(photo: {
  area?: string | null;
  trade?: string | null;
}): string | null {
  const parts = [photo.area?.trim(), photo.trade?.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function photoHasIdentification(photo: {
  caption?: string | null;
  area?: string | null;
  trade?: string | null;
}): boolean {
  return Boolean(photo.area?.trim() || photo.caption?.trim() || photo.trade?.trim());
}

export function groupPhotosByDate<T extends { takenAt: string | Date }>(
  photos: T[],
): { date: string; label: string; photos: T[] }[] {
  const map = new Map<string, T[]>();
  for (const p of photos) {
    const d = new Date(p.takenAt);
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      photos: items,
    }));
}
