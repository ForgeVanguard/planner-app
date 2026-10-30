import { describe, expect, it } from "vitest";
import { createLog, createNonNegotiable } from "../src/domain/model";
import { heatBand, MAX_DAILY_POINTS, scoreDay, suggestRating, isEveningLog, earnedBadgeIds } from "../src/domain/scoring";

function logWith(tactics: boolean[], nn = false, debrief = false) {
  const log = createLog("2026-10-10", "q4-2026", "2026-10-10T12:00:00.000Z");
  log.tactics.calibration = tactics[0];
  log.tactics.connection = tactics[1];
  log.tactics.condition = tactics[2];
  log.tactics.contribution = tactics[3];
  if (nn) log.nonNegotiables["nn-1"] = true;
  if (debrief) log.adjust = "Phone stays in the other room.";
  return log;
}

describe("scoring", () => {
  const items = [createNonNegotiable("nn-1", "Make the bed", "t")];

  it("awards one point per tactic, a full-four bonus, non-negotiables, and the debrief", () => {
    const partial = scoreDay(logWith([true, true, false, false]), items);
    expect(partial.total).toBe(2);
    const full = scoreDay(logWith([true, true, true, true], true, true), items);
    expect(full).toMatchObject({ tactics: 4, full: 2, nn: 1, debrief: 1, total: 8 });
    expect(full.total).toBe(MAX_DAILY_POINTS);
  });

  it("does not award the non-negotiable bonus when the list is empty", () => {
    expect(scoreDay(logWith([true, false, false, false], true, false), []).nn).toBe(0);
  });

  it("suggests a rating from execution and bands the heatmap", () => {
    expect(suggestRating(80)).toBe("hit");
    expect(suggestRating(40)).toBe("partial");
    expect(suggestRating(39)).toBe("missed");
    expect(heatBand(null, true)).toBe("future");
    expect(heatBand(4, false)).toBe("4");
    expect(heatBand(0, false)).toBe("0");
  });

  it("reads evening logs from the local hour and keeps badges after a streak would reset", () => {
    const evening = new Date(2026, 9, 17, 20, 5, 0).toISOString();
    const morning = new Date(2026, 9, 17, 8, 0, 0).toISOString();
    expect(isEveningLog(evening)).toBe(true);
    expect(isEveningLog(morning)).toBe(false);
    expect(earnedBadgeIds({ bestStreak: 7, fullFours: 10, checkpoint30Done: 4, checkpoint60Done: 0, reviewClosed: true })).toEqual(
      expect.arrayContaining(["streak-7", "full-10", "line-30", "closer"]),
    );
  });
});
