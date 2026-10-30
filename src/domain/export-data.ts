import type { DayLog, QuadrantPlan, Quarter, UserData } from "../types";
import { QUADRANT_IDS } from "../types";
import { formatLong } from "./dates";
import { activeNonNegotiables } from "./model";
import { scoreDay } from "./scoring";
import { type ArchiveQuarter } from "./stats";

export interface ExportBundle {
  exportedAt: string;
  quarters: UserData["quarters"];
  plans: UserData["plans"];
  nonNegotiables: UserData["nonNegotiables"];
  logs: DayLog[];
  reviews: UserData["reviews"];
  snapshots: UserData["snapshots"];
  profile: { name: string; email: string; teamId: string | null; visibility: string };
}

export function exportBundle(data: UserData, exportedAt: string): ExportBundle {
  return {
    exportedAt,
    quarters: data.quarters,
    plans: data.plans,
    nonNegotiables: data.nonNegotiables,
    logs: data.logs,
    reviews: data.reviews,
    snapshots: data.snapshots,
    profile: {
      name: data.profile.name,
      email: data.profile.email,
      teamId: data.profile.teamId,
      visibility: data.profile.visibility,
    },
  };
}

export function toJSON(data: UserData, exportedAt: string): string {
  return JSON.stringify(exportBundle(data, exportedAt), null, 2);
}

export function toCSV(data: UserData): string {
  const header = [
    "date",
    "quarter_id",
    "quarter",
    "calibration",
    "connection",
    "condition",
    "contribution",
    "score",
    "points",
    "non_negotiables_done",
    "sustain",
    "improve",
    "adjust",
  ];
  const quarters = new Map(data.quarters.map((quarter) => [quarter.id, quarter.label]));
  const lines = [header.join(",")];
  const logs = [...data.logs].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const log of logs) {
    const items = activeNonNegotiables(data.nonNegotiables[log.quarterId]);
    const score = scoreDay(log, items);
    const done = items.filter((item) => log.nonNegotiables[item.id]).length;
    const cells = [
      log.date,
      log.quarterId,
      quarters.get(log.quarterId) ?? "",
      log.tactics.calibration ? "1" : "0",
      log.tactics.connection ? "1" : "0",
      log.tactics.condition ? "1" : "0",
      log.tactics.contribution ? "1" : "0",
      String(score.quadrantCount),
      String(score.total),
      String(done),
      csvEscape(log.sustain),
      csvEscape(log.improve),
      csvEscape(log.adjust),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  const cleaned = value.replaceAll('"', '""');
  return `"${cleaned}"`;
}

export function toMarkdown(data: UserData): string {
  const lines: string[] = [`# ${data.profile.name}'s quarters`, ""];
  const quarters = [...data.quarters].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  for (const quarter of quarters) {
    lines.push(...quarterMarkdown(quarter, data));
  }
  return lines.join("\n");
}

function quarterMarkdown(quarter: Quarter, data: UserData): string[] {
  const lines = [
    `## ${quarter.label}`,
    "",
    `${formatLong(quarter.startDate)} – ${formatLong(quarter.endDate)} · ${quarter.status}`,
    "",
    quarter.vision.trim() ? quarter.vision.trim() : "_No vision written._",
    "",
  ];
  if (quarter.carryForwardNote.trim()) {
    lines.push(`Carried forward: ${quarter.carryForwardNote.trim()}`, "");
  }
  const plans = data.plans[quarter.id] ?? [];
  for (const quadrant of QUADRANT_IDS) {
    const plan = plans.find((item) => item.quadrant === quadrant);
    lines.push(`### ${labelFor(quadrant)}`, "");
    lines.push(plan?.objective.trim() ? `Objective: ${plan.objective.trim()}` : "Objective: _not set_");
    lines.push(plan?.tactic.trim() ? `Daily tactic: ${plan.tactic.trim()}` : "Daily tactic: _not set_");
    if (plan?.secondaryTactic.trim()) lines.push(`Second tactic: ${plan.secondaryTactic.trim()}`);
    if (plan?.checkpoint30.trim()) lines.push(`Day 30: ${plan.checkpoint30.trim()}${plan.checkpoint30Done ? " (reached)" : ""}`);
    if (plan?.checkpoint60.trim()) lines.push(`Day 60: ${plan.checkpoint60.trim()}${plan.checkpoint60Done ? " (reached)" : ""}`);
    lines.push("");
  }
  const items = activeNonNegotiables(data.nonNegotiables[quarter.id]);
  if (items.length) {
    lines.push("### Non-negotiables", "");
    for (const item of items) lines.push(`- ${item.label}`);
    lines.push("");
  }
  const review = data.reviews[quarter.id];
  if (review) {
    lines.push("### Review", "");
    for (const quadrant of QUADRANT_IDS) {
      const entry = review.quadrants[quadrant];
      lines.push(`- ${labelFor(quadrant)}: ${entry.rating ?? "unrated"}${entry.notes.trim() ? ` — ${entry.notes.trim()}` : ""}`);
    }
    if (review.sustain.trim()) lines.push("", `Sustain: ${review.sustain.trim()}`);
    if (review.improve.trim()) lines.push(`Improve: ${review.improve.trim()}`);
    if (review.adjust.trim()) lines.push(`Adjust: ${review.adjust.trim()}`);
    if (review.carryForward.trim()) lines.push(`Carry forward: ${review.carryForward.trim()}`);
    lines.push("");
  }
  const snapshot = data.snapshots[quarter.id];
  if (snapshot) {
    lines.push(
      `Final numbers: ${snapshot.points} points, ${snapshot.fullFours} full-4 days, best streak ${snapshot.bestStreak}. Community rank ${snapshot.councilRank} of ${snapshot.councilSize}.`,
      "",
    );
  }
  return lines;
}

function labelFor(quadrant: string): string {
  return quadrant.charAt(0).toUpperCase() + quadrant.slice(1);
}

export function planAsText(quarter: Quarter, plans: QuadrantPlan[], items: { label: string }[]): string {
  const lines = [`${quarter.label}`, quarter.vision.trim(), ""];
  for (const quadrant of QUADRANT_IDS) {
    const plan = plans.find((item) => item.quadrant === quadrant);
    lines.push(labelFor(quadrant));
    lines.push(plan?.objective.trim() || "No objective");
    lines.push(plan?.tactic.trim() || "No daily tactic");
    if (plan?.secondaryTactic.trim()) lines.push(plan.secondaryTactic.trim());
    lines.push("");
  }
  if (items.length) {
    lines.push("Non-negotiables");
    for (const item of items) lines.push(`- ${item.label}`);
  }
  return lines.filter((line) => line !== undefined).join("\n").trim();
}

export function weekReport(input: {
  quarterLabel: string;
  rangeLabel: string;
  dates: string[];
  logs: DayLog[];
  items: { id: string; label: string }[];
  councilNote: string;
}): string {
  const lines = [`${input.quarterLabel}`, input.rangeLabel, input.councilNote, ""];
  let points = 0;
  for (const date of input.dates) {
    const log = input.logs.find((item) => item.date === date);
    if (!log) {
      lines.push(`${date}: not logged`);
      continue;
    }
    const score = scoreDay(log, input.items as never);
    points += score.total;
    const marks = QUADRANT_IDS.map((quadrant) => (log.tactics[quadrant] ? quadrant[0].toUpperCase() : "·")).join("");
    lines.push(`${date}: ${marks} · ${score.total} pts`);
  }
  lines.push("", `${points} points in this team week.`);
  return lines.join("\n");
}

export function copyPlans(source: QuadrantPlan[], time: string): QuadrantPlan[] {
  return source.map((plan) => ({
    ...plan,
    checkpoint30Done: false,
    checkpoint60Done: false,
    times: {
      objective: time,
      tactic: time,
      secondaryTactic: time,
      checkpoint30: time,
      checkpoint60: time,
      checkpoint30Done: time,
      checkpoint60Done: time,
    },
  }));
}

export function quarterIdsInExport(data: UserData): string[] {
  return exportBundle(data, "").quarters.map((quarter) => quarter.id);
}
