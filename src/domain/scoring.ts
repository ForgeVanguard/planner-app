import { EVENING_HOUR } from "../config";
import type { DayLog, NonNegotiable, QuadrantId, QuadrantPlan, Rating } from "../types";
import { QUADRANT_IDS } from "../types";
import { activeNonNegotiables } from "./model";

export const POINT_RULES = [
  { id: "tactic", label: "Each quadrant tactic you complete", points: 1 },
  { id: "full", label: "Bonus when all four quadrants are done the same day", points: 2 },
  { id: "nn", label: "Bonus when every non-negotiable is done", points: 1 },
  { id: "debrief", label: "Logging the After Action Review", points: 1 },
] as const;

export const MAX_DAILY_POINTS = 8;

export interface DayScore {
  quadrantCount: number;
  tactics: number;
  full: number;
  nn: number;
  debrief: number;
  total: number;
}

export function quadrantScore(log: Pick<DayLog, "tactics"> | undefined): number {
  if (!log) return 0;
  return QUADRANT_IDS.reduce((sum, quadrant) => sum + (log.tactics[quadrant] ? 1 : 0), 0);
}

export function hasDebrief(log: Pick<DayLog, "sustain" | "improve" | "adjust"> | undefined): boolean {
  if (!log) return false;
  return Boolean(log.sustain.trim() || log.improve.trim() || log.adjust.trim());
}

export function scoreDay(log: DayLog, items: NonNegotiable[]): DayScore {
  const quadrantCount = quadrantScore(log);
  const full = quadrantCount === 4 ? 2 : 0;
  const active = activeNonNegotiables(items);
  const nn = active.length > 0 && active.every((item) => log.nonNegotiables[item.id]) ? 1 : 0;
  const debrief = hasDebrief(log) ? 1 : 0;
  return {
    quadrantCount,
    tactics: quadrantCount,
    full,
    nn,
    debrief,
    total: quadrantCount + full + nn + debrief,
  };
}

export function dayCountsForStreak(log: DayLog): boolean {
  if (quadrantScore(log) > 0) return true;
  if (hasDebrief(log)) return true;
  return Object.values(log.nonNegotiables).some(Boolean);
}

export function isEveningLog(loggedAt: string | null, eveningHour = EVENING_HOUR): boolean {
  if (!loggedAt) return false;
  const date = new Date(loggedAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getHours() >= eveningHour;
}

export function executionForDates(dates: string[], logs: DayLog[]): Record<QuadrantId, number> | null {
  if (dates.length === 0) return null;
  const byDate = new Map(logs.map((log) => [log.date, log]));
  const execution = {} as Record<QuadrantId, number>;
  for (const quadrant of QUADRANT_IDS) {
    const hits = dates.filter((date) => byDate.get(date)?.tactics[quadrant]).length;
    execution[quadrant] = Math.round((hits / dates.length) * 100);
  }
  return execution;
}

/** Suggested rating from execution. Callers hide this when no objective was set. */
export function suggestRating(percent: number): Rating {
  if (percent >= 80) return "hit";
  if (percent >= 40) return "partial";
  return "missed";
}

export function heatBand(score: number | null, future: boolean): "future" | "0" | "1" | "2" | "3" | "4" {
  if (future || score === null) return "future";
  if (score <= 0) return "0";
  if (score === 1) return "1";
  if (score === 2) return "2";
  if (score === 3) return "3";
  return "4";
}

export interface BadgeDef {
  id: string;
  name: string;
  detail: string;
}

export const QUARTER_BADGES: BadgeDef[] = [
  { id: "streak-3", name: "Kindling", detail: "A streak of 3 days inside the quarter. Badges stay after the streak resets." },
  { id: "streak-7", name: "Steady week", detail: "A streak of 7 days inside the quarter." },
  { id: "streak-14", name: "Fortnight", detail: "A streak of 14 days inside the quarter." },
  { id: "streak-30", name: "Month on watch", detail: "A streak of 30 days inside the quarter." },
  { id: "streak-60", name: "Long watch", detail: "A streak of 60 days inside the quarter." },
  { id: "full-10", name: "Ten full days", detail: "10 days with all four quadrants checked." },
  { id: "full-30", name: "Thirty full days", detail: "30 days with all four quadrants checked." },
  { id: "line-30", name: "Day-30 line", detail: "All four day-30 checkpoints marked done." },
  { id: "line-60", name: "Day-60 line", detail: "All four day-60 checkpoints marked done." },
  { id: "closer", name: "Closer", detail: "The quarter review was closed." },
];

export function earnedBadgeIds(input: {
  bestStreak: number;
  fullFours: number;
  checkpoint30Done: number;
  checkpoint60Done: number;
  reviewClosed: boolean;
}): string[] {
  const ids: string[] = [];
  if (input.bestStreak >= 3) ids.push("streak-3");
  if (input.bestStreak >= 7) ids.push("streak-7");
  if (input.bestStreak >= 14) ids.push("streak-14");
  if (input.bestStreak >= 30) ids.push("streak-30");
  if (input.bestStreak >= 60) ids.push("streak-60");
  if (input.fullFours >= 10) ids.push("full-10");
  if (input.fullFours >= 30) ids.push("full-30");
  if (input.checkpoint30Done >= 4) ids.push("line-30");
  if (input.checkpoint60Done >= 4) ids.push("line-60");
  if (input.reviewClosed) ids.push("closer");
  return ids;
}

export function badgeById(id: string): BadgeDef | undefined {
  return QUARTER_BADGES.find((badge) => badge.id === id);
}

export function checkpointsDone(plans: QuadrantPlan[]): { day30: number; day60: number } {
  return {
    day30: plans.filter((plan) => plan.checkpoint30Done).length,
    day60: plans.filter((plan) => plan.checkpoint60Done).length,
  };
}
