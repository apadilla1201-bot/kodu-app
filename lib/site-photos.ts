/** Site Photo / jobsite gallery helpers */

export const PHOTO_TAGS = [
  { id: 'progress', label: 'Progress', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'issue', label: 'Issue', color: 'bg-red-100 text-red-800' },
  { id: 'safety', label: 'Safety', color: 'bg-amber-100 text-amber-800' },
  { id: 'delivery', label: 'Delivery', color: 'bg-blue-100 text-blue-800' },
  { id: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700' },
] as const;

export type PhotoTagId = (typeof PHOTO_TAGS)[number]['id'];

export function photoTagLabel(tag: string): string {
  return PHOTO_TAGS.find((t) => t.id === tag)?.label ?? tag;
}

export function photoTagStyle(tag: string): string {
  return PHOTO_TAGS.find((t) => t.id === tag)?.color ?? 'bg-gray-100 text-gray-700';
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
