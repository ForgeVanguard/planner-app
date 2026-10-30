import { describe, expect, it } from "vitest";
import { addDays } from "../src/domain/dates";
import { computeStreak } from "../src/domain/streaks";

const start = "2026-10-05";

describe("streaks", () => {
  it("keeps today's open day from breaking a live streak", () => {
    const dates = ["2026-10-16", "2026-10-17"];
    const streak = computeStreak(dates, "2026-10-18", start, "2027-01-03", true);
    expect(streak.current).toBe(2);
  });

  it("breaks when yesterday was missed", () => {
    const dates = ["2026-10-15", "2026-10-16"];
    const streak = computeStreak(dates, "2026-10-18", start, "2027-01-03", true);
    expect(streak.current).toBe(0);
    expect(streak.best).toBe(2);
  });

  it("counts a finished quarter without grace on the last empty day", () => {
    const dates = [start, addDays(start, 1), addDays(start, 2)];
    const open = computeStreak(dates, addDays(start, 3), start, addDays(start, 3), true);
    const closed = computeStreak(dates, addDays(start, 3), start, addDays(start, 3), false);
    expect(open.current).toBe(3);
    expect(closed.current).toBe(0);
    expect(closed.best).toBe(3);
  });

  it("finds the best run even when the current run is shorter", () => {
    const dates = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-10", "2026-10-11"];
    const streak = computeStreak(dates, "2026-10-11", start, "2027-01-03", true);
    expect(streak.current).toBe(2);
    expect(streak.best).toBe(3);
  });
});
