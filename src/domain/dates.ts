const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(now = new Date()): string {
  return formatISODate(now);
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

export function diffDays(from: string, to: string): number {
  const ms = parseISODate(to).getTime() - parseISODate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function enumerateDays(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    if (out.length > 400) break;
  }
  return out;
}

export function dayOfWeek(iso: string): number {
  return parseISODate(iso).getDay();
}

/** Monday = 0 … Sunday = 6. Used for the shared quarter calendar grid. */
export function mondayOffset(iso: string): number {
  const day = dayOfWeek(iso);
  return day === 0 ? 6 : day - 1;
}

export function formatLong(iso: string): string {
  const date = parseISODate(iso);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatMedium(iso: string): string {
  const date = parseISODate(iso);
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function formatWeekday(iso: string): string {
  const date = parseISODate(iso);
  return `${WEEKDAY_NAMES[date.getDay()]}, ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function formatWeekdayLong(iso: string): string {
  const date = parseISODate(iso);
  return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISODate(value);
  return formatISODate(date) === value;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
