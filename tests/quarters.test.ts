import { describe, expect, it } from "vitest";
import { addDays, diffDays, enumerateDays, formatLong } from "../src/domain/dates";
import { daysLeftInclusive, dayNumber, quarterLength } from "../src/domain/quarters";
import { endFromLength } from "../src/domain/model";

describe("quarter calendar", () => {
  it("counts the start and end dates of the canonical 13-week quarter", () => {
    expect(quarterLength("2026-10-05", "2027-01-03")).toBe(91);
    expect(endFromLength("2026-10-05", 91)).toBe("2027-01-03");
    expect(enumerateDays("2026-10-05", "2027-01-03")).toHaveLength(91);
  });

  it("numbers 19 Oct 2026 as day 15 with 77 days left, including today", () => {
    expect(diffDays("2026-10-05", "2026-10-19")).toBe(14);
    expect(dayNumber("2026-10-05", "2026-10-19")).toBe(15);
    expect(daysLeftInclusive("2026-10-19", "2027-01-03")).toBe(77);
    expect(formatLong("2026-10-19")).toBe("October 19, 2026");
  });

  it("supports a custom length", () => {
    expect(quarterLength("2026-01-01", endFromLength("2026-01-01", 28))).toBe(28);
    expect(addDays("2026-10-05", 29)).toBe("2026-11-03");
  });
});
