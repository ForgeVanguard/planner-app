import type {
  DayLog,
  NonNegotiable,
  QuadrantId,
  QuadrantPlan,
  Quarter,
  QuarterReview,
  QuarterSnapshot,
  SampleMember,
  Visibility,
} from "../types";
import { QUADRANT_IDS } from "../types";
import { addDays, enumerateDays } from "./dates";
import { activeNonNegotiables } from "./model";
import { datesForRating } from "./quarters";
import {
  checkpointsDone,
  dayCountsForStreak,
  earnedBadgeIds,
  executionForDates,
  isEveningLog,
  QUARTER_BADGES,
  scoreDay,
  type BadgeDef,
} from "./scoring";
import { computeStreak } from "./streaks";

export interface PointBreakdown {
  tactics: number;
  fullBonus: number;
  nonNegotiables: number;
  debriefs: number;
  total: number;
}

export interface QuarterStats {
  elapsedDays: number;
  length: number;
  points: number;
  breakdown: PointBreakdown;
  daysLogged: number;
  fullFours: number;
  currentStreak: number;
  bestStreak: number;
  eveningLogs: number;
  execution: Record<QuadrantId, number>;
  missedDates: string[];
  badges: string[];
  checkpoint30Done: number;
  checkpoint60Done: number;
}

export function logsForQuarter(logs: DayLog[], quarterId: string): DayLog[] {
  return logs.filter((log) => log.quarterId === quarterId);
}

export function summarizeQuarter(input: {
  quarter: Quarter;
  logs: DayLog[];
  nonNegotiables: NonNegotiable[];
  plans: QuadrantPlan[];
  review?: QuarterReview;
  today: string;
}): QuarterStats {
  const { quarter, today } = input;
  const items = input.nonNegotiables;
  const logs = logsForQuarter(input.logs, quarter.id);
  const byDate = new Map(logs.map((log) => [log.date, log]));
  const elapsed = datesForRating(quarter, today);
  const length = enumerateDays(quarter.startDate, quarter.endDate).length;
  const breakdown: PointBreakdown = { tactics: 0, fullBonus: 0, nonNegotiables: 0, debriefs: 0, total: 0 };
  let daysLogged = 0;
  let fullFours = 0;
  let eveningLogs = 0;
  const streakDates: string[] = [];
  for (const date of elapsed) {
    const log = byDate.get(date);
    if (!log) continue;
    const score = scoreDay(log, items);
    breakdown.tactics += score.tactics;
    breakdown.fullBonus += score.full;
    breakdown.nonNegotiables += score.nn;
    breakdown.debriefs += score.debrief;
    breakdown.total += score.total;
    if (dayCountsForStreak(log)) {
      daysLogged += 1;
      streakDates.push(date);
    }
    if (score.quadrantCount === 4) fullFours += 1;
    if (isEveningLog(log.loggedAt)) eveningLogs += 1;
  }
  const execution = executionForDates(elapsed, logs) ?? {
    calibration: 0,
    connection: 0,
    condition: 0,
    contribution: 0,
  };
  const grace = quarter.status !== "closed";
  const asOf = quarter.status === "closed" ? quarter.endDate : today < quarter.endDate ? today : quarter.endDate;
  const streak = computeStreak(streakDates, asOf, quarter.startDate, quarter.endDate, grace);
  const checks = checkpointsDone(input.plans);
  const badges = earnedBadgeIds({
    bestStreak: streak.best,
    fullFours,
    checkpoint30Done: checks.day30,
    checkpoint60Done: checks.day60,
    reviewClosed: Boolean(input.review?.closed || quarter.status === "closed"),
  });
  const missedEnd = quarter.status === "closed" ? quarter.endDate : addDays(today, -1);
  const missedCap = missedEnd < quarter.endDate ? missedEnd : quarter.endDate;
  const missedDates =
    missedCap < quarter.startDate
      ? []
      : enumerateDays(quarter.startDate, missedCap).filter((date) => !byDate.has(date));
  return {
    elapsedDays: elapsed.length,
    length,
    points: breakdown.total,
    breakdown,
    daysLogged,
    fullFours,
    currentStreak: streak.current,
    bestStreak: streak.best,
    eveningLogs,
    execution,
    missedDates,
    badges,
    checkpoint30Done: checks.day30,
    checkpoint60Done: checks.day60,
  };
}

export interface StandingRow {
  userId: string;
  name: string;
  teamId: string | null;
  visibility: Visibility;
  points: number;
  daysLogged: number;
  fullFours: number;
  currentStreak: number;
  badges: string[];
  eveningLogs: number;
  sample: boolean;
}

export function competitionRank(points: number, rows: { points: number }[]): number {
  return 1 + rows.filter((row) => row.points > points).length;
}

export function visibleStandings(
  rows: StandingRow[],
  viewer: { userId: string; teamId: string | null },
  scope: "council" | "team",
): StandingRow[] {
  return rows
    .filter((row) => {
      if (scope === "team" && row.teamId !== viewer.teamId) return false;
      if (row.userId === viewer.userId) return true;
      if (row.visibility === "private") return false;
      if (row.visibility === "team" && row.teamId !== viewer.teamId) return false;
      return true;
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export function buildSnapshot(input: {
  quarter: Quarter;
  stats: QuarterStats;
  rows: StandingRow[];
  viewerId: string;
  teamId: string | null;
  closedAt: string;
}): QuarterSnapshot {
  const mine = input.rows.find((row) => row.userId === input.viewerId);
  const points = mine?.points ?? input.stats.points;
  const council = input.rows;
  const teamRows = input.rows.filter((row) => row.teamId && row.teamId === input.teamId);
  return {
    quarterId: input.quarter.id,
    points,
    fullFours: input.stats.fullFours,
    bestStreak: input.stats.bestStreak,
    streakAtClose: input.stats.currentStreak,
    daysLogged: input.stats.daysLogged,
    execution: input.stats.execution,
    councilRank: competitionRank(points, council),
    councilSize: council.length,
    teamRank: input.teamId ? competitionRank(points, teamRows) : null,
    teamSize: teamRows.length,
    badges: input.stats.badges,
    closedAt: input.closedAt,
  };
}

export interface LifetimeStats {
  quartersCompleted: number;
  quartersStarted: number;
  lifetimePoints: number;
  bestStreak: number;
  currentStreak: number;
  fullFours: number;
  daysLogged: number;
}

export const LIFETIME_BADGES: BadgeDef[] = [
  { id: "life-close-1", name: "First close", detail: "Closed one quarter review." },
  { id: "life-close-2", name: "Two campaigns", detail: "Closed two quarters." },
  { id: "life-close-3", name: "Three campaigns", detail: "Closed three quarters." },
  { id: "life-points-100", name: "Century", detail: "100 lifetime points across every quarter." },
  { id: "life-points-500", name: "Long count", detail: "500 lifetime points." },
  { id: "life-streak-14", name: "Unbroken fortnight", detail: "A 14-day streak that can cross quarter boundaries." },
  { id: "life-streak-30", name: "Unbroken month", detail: "A 30-day streak across the whole record." },
];

export function lifetimeStats(input: {
  quarters: Quarter[];
  logs: DayLog[];
  nonNegotiables: Record<string, NonNegotiable[]>;
  today: string;
}): LifetimeStats {
  const started = input.quarters.filter((quarter) => quarter.status !== "draft" && quarter.startDate <= input.today);
  const completed = started.filter((quarter) => quarter.status === "closed");
  let lifetimePoints = 0;
  let fullFours = 0;
  let daysLogged = 0;
  const streakDates: string[] = [];
  let earliest = input.today;
  for (const quarter of started) {
    if (quarter.startDate < earliest) earliest = quarter.startDate;
    const stats = summarizeQuarter({
      quarter,
      logs: input.logs,
      nonNegotiables: input.nonNegotiables[quarter.id] ?? [],
      plans: [],
      today: input.today,
    });
    lifetimePoints += stats.points;
    fullFours += stats.fullFours;
    daysLogged += stats.daysLogged;
    for (const log of logsForQuarter(input.logs, quarter.id)) {
      if (dayCountsForStreak(log)) streakDates.push(log.date);
    }
  }
  const streak = computeStreak(streakDates, input.today, earliest, input.today, true);
  return {
    quartersCompleted: completed.length,
    quartersStarted: started.length,
    lifetimePoints,
    bestStreak: streak.best,
    currentStreak: streak.current,
    fullFours,
    daysLogged,
  };
}

export function lifetimeBadgeIds(stats: LifetimeStats): string[] {
  const ids: string[] = [];
  if (stats.quartersCompleted >= 1) ids.push("life-close-1");
  if (stats.quartersCompleted >= 2) ids.push("life-close-2");
  if (stats.quartersCompleted >= 3) ids.push("life-close-3");
  if (stats.lifetimePoints >= 100) ids.push("life-points-100");
  if (stats.lifetimePoints >= 500) ids.push("life-points-500");
  if (stats.bestStreak >= 14) ids.push("life-streak-14");
  if (stats.bestStreak >= 30) ids.push("life-streak-30");
  return ids;
}

export function allBadgeDefs(): BadgeDef[] {
  return [...QUARTER_BADGES, ...LIFETIME_BADGES];
}

export interface ArchiveQuarter {
  quarter: Quarter;
  stats: QuarterStats;
  snapshot: QuarterSnapshot | null;
  review?: QuarterReview;
}

export function archiveQuarters(input: {
  quarters: Quarter[];
  logs: DayLog[];
  nonNegotiables: Record<string, NonNegotiable[]>;
  plans: Record<string, QuadrantPlan[]>;
  reviews: Record<string, QuarterReview>;
  snapshots: Record<string, QuarterSnapshot>;
  today: string;
}): ArchiveQuarter[] {
  return input.quarters
    .filter((quarter) => quarter.status !== "draft" && quarter.startDate <= input.today)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
    .map((quarter) => ({
      quarter,
      stats: summarizeQuarter({
        quarter,
        logs: input.logs,
        nonNegotiables: input.nonNegotiables[quarter.id] ?? [],
        plans: input.plans[quarter.id] ?? [],
        review: input.reviews[quarter.id],
        today: input.today,
      }),
      snapshot: input.snapshots[quarter.id] ?? null,
      review: input.reviews[quarter.id],
    }));
}

export function debriefsFor(logs: DayLog[], quarterId: string): DayLog[] {
  return logs
    .filter(
      (log) =>
        log.quarterId === quarterId && (log.sustain.trim() || log.improve.trim() || log.adjust.trim()),
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface QuarterComparison {
  left: ArchiveQuarter;
  right: ArchiveQuarter;
  pointsDelta: number;
  streakDelta: number;
  executionDelta: Record<QuadrantId, number>;
}

export function compareArchives(left: ArchiveQuarter, right: ArchiveQuarter): QuarterComparison {
  const executionDelta = {} as Record<QuadrantId, number>;
  for (const quadrant of QUADRANT_IDS) {
    const leftValue = left.snapshot?.execution[quadrant] ?? left.stats.execution[quadrant];
    const rightValue = right.snapshot?.execution[quadrant] ?? right.stats.execution[quadrant];
    executionDelta[quadrant] = rightValue - leftValue;
  }
  const leftPoints = left.snapshot?.points ?? left.stats.points;
  const rightPoints = right.snapshot?.points ?? right.stats.points;
  const leftStreak = left.snapshot?.bestStreak ?? left.stats.bestStreak;
  const rightStreak = right.snapshot?.bestStreak ?? right.stats.bestStreak;
  return {
    left,
    right,
    pointsDelta: rightPoints - leftPoints,
    streakDelta: rightStreak - leftStreak,
    executionDelta,
  };
}

export function sampleRow(member: SampleMember, quarterId: string): StandingRow {
  return {
    userId: member.userId,
    name: member.name,
    teamId: member.teamId,
    visibility: member.visibility,
    points: member.pointsByQuarter[quarterId] ?? 0,
    daysLogged: member.daysLogged,
    fullFours: member.fullFours,
    currentStreak: member.streak,
    badges: member.badges,
    eveningLogs: member.eveningLogs,
    sample: true,
  };
}

export function activeItems(items: NonNegotiable[] | undefined): NonNegotiable[] {
  return activeNonNegotiables(items);
}
