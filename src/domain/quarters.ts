import { DEFAULT_QUARTER_LENGTH } from "../config";
import type { Quarter } from "../types";
import { addDays, diffDays, enumerateDays } from "./dates";

export function quarterLength(start: string, end: string): number {
  if (end < start) return 0;
  return diffDays(start, end) + 1;
}

/** Day 1 is the start date. */
export function dayNumber(start: string, date: string): number {
  return diffDays(start, date) + 1;
}

/** Days still inside the quarter, including `date` when it falls on or before the end. */
export function daysLeftInclusive(date: string, end: string): number {
  if (date > end) return 0;
  return diffDays(date, end) + 1;
}

export function checkpointDate(start: string, day: number): string {
  return addDays(start, day - 1);
}

export function quarterContaining(quarters: Quarter[], date: string): Quarter | null {
  const matches = quarters.filter(
    (quarter) => quarter.status !== "draft" && quarter.startDate <= date && date <= quarter.endDate,
  );
  if (matches.length === 0) return null;
  return matches.find((quarter) => quarter.status === "active") ?? matches[0];
}

export function nextDraft(quarters: Quarter[], current: Quarter | null): Quarter | null {
  const drafts = quarters.filter((quarter) => quarter.status === "draft");
  if (!current) return drafts[0] ?? null;
  const after = drafts
    .filter((quarter) => quarter.startDate > current.endDate)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  return after[0] ?? drafts[0] ?? null;
}

export function browsableQuarters(quarters: Quarter[], today: string): Quarter[] {
  return quarters
    .filter((quarter) => quarter.status !== "draft" && quarter.startDate <= today)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

export function isQuarterEditable(quarter: Quarter | null | undefined): boolean {
  return Boolean(quarter && quarter.status !== "closed");
}

export function datesForRating(quarter: Quarter, today: string): string[] {
  if (quarter.status === "closed") return enumerateDays(quarter.startDate, quarter.endDate);
  const end = today < quarter.endDate ? today : quarter.endDate;
  return enumerateDays(quarter.startDate, end);
}

export function defaultLength(): number {
  return DEFAULT_QUARTER_LENGTH;
}
