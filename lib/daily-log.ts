/** Daily log date helpers */

export function startOfDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Normalize to noon UTC for stable DB unique key per calendar day. */
export function logDateFromInput(d: Date | string): Date {
  const key = typeof d === 'string' ? d.slice(0, 10) : dateKey(d);
  return new Date(`${key}T12:00:00.000Z`);
}

export function dateKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return startOfDay(x).toISOString().slice(0, 10);
}

export function formatLogDate(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export const DAILY_LOG_STATUSES = ['Draft', 'Submitted', 'Approved'] as const;

export const WEATHER_OPTIONS = [
  'Clear',
  'Partly Cloudy',
  'Cloudy',
  'Rain',
  'Heavy Rain',
  'Wind',
  'Hot',
  'Cold',
] as const;

/** Last 7 calendar days ending today (inclusive). */
export function weekRangeEnding(end: Date = new Date()): { from: string; to: string } {
  const to = startOfDay(end);
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return { from: dateKey(from), to: dateKey(to) };
}
