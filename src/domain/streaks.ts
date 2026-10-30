import { addDays, enumerateDays } from "./dates";

/**
 * Current streak walks backward from `asOf`.
 * When `graceOpenDay` is true (the quarter is still open), an empty today does not
 * break a streak that was alive yesterday. A closed quarter does not get that grace.
 */
export function computeStreak(
  activeDates: Iterable<string>,
  asOf: string,
  rangeStart: string,
  rangeEnd: string,
  graceOpenDay: boolean,
): { current: number; best: number } {
  const end = asOf < rangeEnd ? asOf : rangeEnd;
  if (end < rangeStart) return { current: 0, best: 0 };
  const set = new Set<string>();
  for (const date of activeDates) {
    if (date >= rangeStart && date <= end) set.add(date);
  }
  let best = 0;
  let run = 0;
  for (const day of enumerateDays(rangeStart, end)) {
    if (set.has(day)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  let cursor = end;
  if (!set.has(cursor)) {
    if (!graceOpenDay) return { current: 0, best };
    const previous = addDays(cursor, -1);
    if (previous < rangeStart || !set.has(previous)) return { current: 0, best };
    cursor = previous;
  }
  let current = 0;
  while (cursor >= rangeStart && set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  if (current > best) best = current;
  return { current, best };
}
