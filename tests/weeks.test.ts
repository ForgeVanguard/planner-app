import { describe, expect, it } from "vitest";
import { dayLock, editIsLate, endOfZonedDay, formatRemaining, previousWeek, weekClose, weekRangeContaining } from "../src/domain/weeks";

describe("team weeks", () => {
  it("runs a Thursday team from Thursday through Wednesday", () => {
    const week = weekRangeContaining("2026-10-19", 4);
    expect(week).toEqual({ start: "2026-10-15", end: "2026-10-21" });
    expect(previousWeek(week)).toEqual({ start: "2026-10-08", end: "2026-10-14" });
  });

  it("uses a different window for a Monday team on the same date", () => {
    expect(weekRangeContaining("2026-10-19", 1)).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(weekRangeContaining("2026-10-19", 0)).toEqual({ start: "2026-10-18", end: "2026-10-24" });
  });

  it("closes the week at the end of the day before the next call", () => {
    const week = weekRangeContaining("2026-10-19", 4);
    const deadline = endOfZonedDay(week.end, "America/New_York");
    expect(deadline.toISOString()).toBe("2026-10-22T03:59:59.000Z");
    const during = weekClose(new Date("2026-10-19T15:00:00.000Z"), week, "America/New_York");
    expect(during.closed).toBe(false);
    expect(during.finalizeByDate).toBe("2026-10-21");
    expect(during.closesInLabel.endsWith("days") || during.closesInLabel.endsWith("hours")).toBe(true);
    const after = weekClose(new Date("2026-10-22T04:00:00.000Z"), week, "America/New_York");
    expect(after.closed).toBe(true);
    expect(formatRemaining(0)).toBe("closed");
  });

  it("flags an edit made after the cutoff and keeps an offline edit stamped before it", () => {
    expect(editIsLate("2026-10-22T05:00:00.000Z", "2026-10-16", 4, "America/New_York")).toBe(true);
    expect(editIsLate("2026-10-21T18:00:00.000Z", "2026-10-16", 4, "America/New_York")).toBe(false);
    expect(editIsLate("2026-10-18T12:00:00.000Z", "2026-10-19", 4, "America/New_York")).toBe(false);
  });

  it("locks a closed team week unless a late correction is explicitly opened", () => {
    const now = new Date("2026-10-19T15:00:00.000Z");
    const open = dayLock({
      date: "2026-10-16",
      today: "2026-10-19",
      inQuarter: true,
      quarterClosed: false,
      weekStartDay: 4,
      timeZone: "America/New_York",
      now,
      lateUnlocked: false,
    });
    expect(open.editable).toBe(true);
    const later = dayLock({ ...openInput(now), date: "2026-10-10", now: new Date("2026-10-19T15:00:00.000Z") });
    expect(later.closedWeek).toBe(true);
    expect(later.editable).toBe(false);
    const unlocked = dayLock({
      date: "2026-10-10",
      today: "2026-10-19",
      inQuarter: true,
      quarterClosed: false,
      weekStartDay: 4,
      timeZone: "America/New_York",
      now,
      lateUnlocked: true,
    });
    expect(unlocked.editable).toBe(true);
    expect(unlocked.late).toBe(true);
  });
});

function openInput(now: Date) {
  return {
    date: "2026-10-16",
    today: "2026-10-19",
    inQuarter: true,
    quarterClosed: false,
    weekStartDay: 4,
    timeZone: "America/New_York",
    now,
    lateUnlocked: false,
  };
}
