import { describe, expect, it } from "vitest";
import { colors, quadrants } from "../src/theme";
import { contrastRatio } from "../src/domain/contrast";
import { buildDemoData } from "../src/data/demo-seed";
import { quarterIdsInExport, toCSV, toJSON, toMarkdown } from "../src/domain/export-data";
import { archiveQuarters, compareArchives, lifetimeBadgeIds, lifetimeStats } from "../src/domain/stats";
import { quarterLength } from "../src/domain/quarters";
import { isQuarterEditable } from "../src/domain/quarters";

const today = "2026-10-19";

describe("archive, export, and contrast", () => {
  const data = buildDemoData(today);

  it("keeps every quarter in the record and in every export", () => {
    expect(data.quarters.map((quarter) => quarter.id)).toEqual(["q2-2026", "q3-2026", "q4-2026", "q1-2027"]);
    expect(quarterIdsInExport(data)).toEqual(["q2-2026", "q3-2026", "q4-2026", "q1-2027"]);
    const json = toJSON(data, "2026-10-19T00:00:00.000Z");
    expect(json).toContain("q2-2026");
    expect(json).toContain("q3-2026");
    expect(toCSV(data)).toContain("q2-2026");
    expect(toMarkdown(data)).toContain("Q2 2026");
    expect(toMarkdown(data)).toContain("Q4 2026");
    expect(data.quarters.filter((quarter) => quarter.status === "closed").every((quarter) => data.snapshots[quarter.id])).toBe(true);
  });

  it("leaves past quarters read-only until reopened and builds a real comparison", () => {
    const q3 = data.quarters.find((quarter) => quarter.id === "q3-2026");
    const q4 = data.quarters.find((quarter) => quarter.id === "q4-2026");
    expect(isQuarterEditable(q3)).toBe(false);
    expect(isQuarterEditable(q4)).toBe(true);
    expect(quarterLength(q4!.startDate, q4!.endDate)).toBe(91);
    const archived = archiveQuarters({
      quarters: data.quarters,
      logs: data.logs,
      nonNegotiables: data.nonNegotiables,
      plans: data.plans,
      reviews: data.reviews,
      snapshots: data.snapshots,
      today,
    });
    expect(archived.map((item) => item.quarter.id)).toEqual(["q4-2026", "q3-2026", "q2-2026"]);
    const comparison = compareArchives(archived[1], archived[0]);
    expect(comparison.left.quarter.id).toBe("q3-2026");
    expect(typeof comparison.pointsDelta).toBe("number");
    const life = lifetimeStats({
      quarters: data.quarters,
      logs: data.logs,
      nonNegotiables: data.nonNegotiables,
      today,
    });
    expect(life.quartersCompleted).toBe(2);
    expect(life.lifetimePoints).toBeGreaterThan(archived[0].stats.points);
    expect(lifetimeBadgeIds(life)).toContain("life-close-2");
  });

  it("opens two recent days for back-fill and keeps a debrief on the day between them", () => {
    const dates = new Set(data.logs.filter((log) => log.quarterId === "q4-2026").map((log) => log.date));
    expect(dates.has("2026-10-16")).toBe(false);
    expect(dates.has("2026-10-18")).toBe(false);
    const debrief = data.logs.find((log) => log.date === "2026-10-17");
    expect(debrief?.adjust).toContain("other room");
  });

  it("meets WCAG AA for the text pairs the UI actually uses", () => {
    expect(contrastRatio(colors.text, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textSecondary, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.brandInk, colors.brand)).toBeGreaterThanOrEqual(4.5);
    for (const quadrant of Object.values(quadrants)) {
      expect(contrastRatio(quadrant.text, colors.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
