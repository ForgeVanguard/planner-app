import type { DayLog } from "../types";
import { QUADRANT_IDS } from "../types";
import { addDays, dayOfWeek, enumerateDays, formatLong, WEEKDAY_NAMES } from "./dates";

export interface DateRange {
  start: string;
  end: string;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The week that contains `date`, starting on `weekStartDay` (0 Sunday … 6 Saturday). */
export function weekRangeContaining(date: string, weekStartDay: number): DateRange {
  const delta = (dayOfWeek(date) - weekStartDay + 7) % 7;
  const start = addDays(date, -delta);
  return { start, end: addDays(start, 6) };
}

export function shiftWeek(range: DateRange, weeks: number): DateRange {
  return {
    start: addDays(range.start, weeks * 7),
    end: addDays(range.end, weeks * 7),
  };
}

export function previousWeek(range: DateRange): DateRange {
  return shiftWeek(range, -1);
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
  let hour = Number(map.hour);
  let day = Number(map.day);
  let month = Number(map.month);
  let year = Number(map.year);
  if (hour === 24) {
    hour = 0;
    const rolled = new Date(Date.UTC(year, month - 1, day));
    rolled.setUTCDate(rolled.getUTCDate() + 1);
    year = rolled.getUTCFullYear();
    month = rolled.getUTCMonth() + 1;
    day = rolled.getUTCDate();
  }
  return {
    year,
    month,
    day,
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** 23:59:59 in `timeZone` on the given calendar date. */
export function endOfZonedDay(isoDate: string, timeZone: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  let utc = Date.UTC(y, m - 1, d, 23, 59, 59);
  for (let i = 0; i < 4; i += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    const got = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const want = Date.UTC(y, m - 1, d, 23, 59, 59);
    const delta = want - got;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

export interface WeekClose {
  /** True once the clock has passed the end of the week in the team timezone. */
  closed: boolean;
  deadlineMs: number;
  msRemaining: number;
  /** The last day of the week — the day before the next team call. */
  finalizeByDate: string;
  closesInLabel: string;
}

export function weekClose(now: Date, week: DateRange, timeZone: string): WeekClose {
  const deadline = endOfZonedDay(week.end, timeZone);
  const msRemaining = deadline.getTime() - now.getTime();
  return {
    closed: msRemaining <= 0,
    deadlineMs: deadline.getTime(),
    msRemaining,
    finalizeByDate: week.end,
    closesInLabel: formatRemaining(msRemaining),
  };
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "closed";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 48) {
    if (hours < 1) {
      const mins = Math.max(1, Math.round(ms / 60_000));
      return mins === 1 ? "1 minute" : `${mins} minutes`;
    }
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = Math.round(ms / 86_400_000);
  return days === 1 ? "1 day" : `${days} days`;
}

/** An edit is late when its timestamp is after the team week that contains the day has closed. */
export function editIsLate(editIso: string, day: string, weekStartDay: number, timeZone: string): boolean {
  const week = weekRangeContaining(day, weekStartDay);
  const deadline = endOfZonedDay(week.end, timeZone);
  const edited = new Date(editIso).getTime();
  if (Number.isNaN(edited)) return false;
  return edited > deadline.getTime();
}

export function clipToQuarter(range: DateRange, startDate: string, endDate: string, today: string, future: boolean): string[] {
  const cap = future ? range.end : today < range.end ? today : range.end;
  const start = range.start > startDate ? range.start : startDate;
  const end = cap < endDate ? cap : endDate;
  return enumerateDays(start, end);
}

export function weekdayName(day: number): string {
  return WEEKDAY_NAMES[((day % 7) + 7) % 7] ?? "Sunday";
}

export function weekSpanLabel(range: DateRange): string {
  return `${formatLong(range.start)} – ${formatLong(range.end)}`;
}

export interface DayLock {
  editable: boolean;
  late: boolean;
  closedWeek: boolean;
  message: string | null;
}

/** Past team weeks lock. A late correction stays editable and is flagged by its timestamp. */
export function dayLock(input: {
  date: string;
  today: string;
  inQuarter: boolean;
  quarterClosed: boolean;
  weekStartDay: number;
  timeZone: string;
  now: Date;
  lateUnlocked: boolean;
}): DayLock {
  if (!input.inQuarter) {
    return { editable: false, late: false, closedWeek: false, message: "That day sits outside this quarter." };
  }
  if (input.date > input.today) {
    return { editable: false, late: false, closedWeek: false, message: "You can't log a day that hasn't happened." };
  }
  if (input.quarterClosed) {
    return {
      editable: false,
      late: false,
      closedWeek: false,
      message: "This quarter is closed and read-only. Reopen it from Review if you need to change it.",
    };
  }
  const week = weekRangeContaining(input.date, input.weekStartDay);
  const close = weekClose(input.now, week, input.timeZone);
  if (!close.closed) return { editable: true, late: false, closedWeek: false, message: null };
  if (input.lateUnlocked) {
    return {
      editable: true,
      late: true,
      closedWeek: true,
      message: `Late correction. This ${weekdayName(input.weekStartDay)} team week closed ${formatLong(close.finalizeByDate)}. The change stays flagged.`,
    };
  }
  return {
    editable: false,
    late: false,
    closedWeek: true,
    message: `This team week closed ${formatLong(close.finalizeByDate)}. Numbers were due by the end of that day, before the call. You can file a late correction, and it will stay flagged.`,
  };
}

export function logIsLate(log: DayLog, weekStartDay: number, timeZone: string): boolean {
  const times = [
    ...QUADRANT_IDS.map((quadrant) => log.times.tactics[quadrant]),
    ...Object.values(log.times.nonNegotiables),
    log.times.sustain,
    log.times.improve,
    log.times.adjust,
  ];
  return times.some((time) => Boolean(time) && editIsLate(time, log.date, weekStartDay, timeZone));
}

export function formatCallTime(callTime: string): string {
  const [hRaw, mRaw] = callTime.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return callTime;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}
