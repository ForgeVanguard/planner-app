import { DEFAULT_QUARTER_LENGTH } from "../config";
import type {
  DayLog,
  NonNegotiable,
  Profile,
  QuadrantId,
  QuadrantPlan,
  Quarter,
  QuarterReview,
  QuarterStatus,
  UserData,
} from "../types";
import { QUADRANT_IDS } from "../types";
import { addDays } from "./dates";

export function blankTactics(): Record<QuadrantId, boolean> {
  return { calibration: false, connection: false, condition: false, contribution: false };
}

export function blankTacticTimes(time: string): Record<QuadrantId, string> {
  return { calibration: time, connection: time, condition: time, contribution: time };
}

export function createLog(date: string, quarterId: string, time = ""): DayLog {
  return {
    date,
    quarterId,
    tactics: blankTactics(),
    nonNegotiables: {},
    sustain: "",
    improve: "",
    adjust: "",
    loggedAt: null,
    times: {
      quarterId: time,
      tactics: blankTacticTimes(time),
      nonNegotiables: {},
      sustain: time,
      improve: time,
      adjust: time,
      loggedAt: time,
    },
  };
}

export function createPlan(quadrant: QuadrantId, time = ""): QuadrantPlan {
  const times = {
    objective: time,
    tactic: time,
    secondaryTactic: time,
    checkpoint30: time,
    checkpoint60: time,
    checkpoint30Done: time,
    checkpoint60Done: time,
  };
  return {
    quadrant,
    objective: "",
    tactic: "",
    secondaryTactic: "",
    checkpoint30: "",
    checkpoint60: "",
    checkpoint30Done: false,
    checkpoint60Done: false,
    times,
  };
}

export function createPlans(time = ""): QuadrantPlan[] {
  return QUADRANT_IDS.map((quadrant) => createPlan(quadrant, time));
}

export function createReview(time = ""): QuarterReview {
  const quadrants = {
    calibration: { rating: null, notes: "" },
    connection: { rating: null, notes: "" },
    condition: { rating: null, notes: "" },
    contribution: { rating: null, notes: "" },
  } as QuarterReview["quadrants"];
  const qTimes = {
    calibration: { rating: time, notes: time },
    connection: { rating: time, notes: time },
    condition: { rating: time, notes: time },
    contribution: { rating: time, notes: time },
  };
  return {
    quadrants,
    sustain: "",
    improve: "",
    adjust: "",
    carryForward: "",
    closed: false,
    times: {
      quadrants: qTimes,
      sustain: time,
      improve: time,
      adjust: time,
      carryForward: time,
      closed: time,
    },
  };
}

export function endFromLength(start: string, length = DEFAULT_QUARTER_LENGTH): string {
  return addDays(start, Math.max(1, length) - 1);
}

export function suggestLabel(start: string): string {
  const [year, month] = start.split("-").map(Number);
  const quarter = Math.floor(((month ?? 1) - 1) / 3) + 1;
  return `Q${quarter} ${year}`;
}

export function createQuarter(input: {
  id: string;
  label?: string;
  startDate: string;
  endDate?: string;
  length?: number;
  status?: QuarterStatus;
  vision?: string;
  carryForwardNote?: string;
  time?: string;
}): Quarter {
  const time = input.time ?? "";
  const endDate = input.endDate ?? endFromLength(input.startDate, input.length ?? DEFAULT_QUARTER_LENGTH);
  return {
    id: input.id,
    label: input.label ?? suggestLabel(input.startDate),
    startDate: input.startDate,
    endDate,
    status: input.status ?? "active",
    vision: input.vision ?? "",
    carryForwardNote: input.carryForwardNote ?? "",
    times: {
      label: time,
      startDate: time,
      endDate: time,
      status: time,
      vision: time,
      carryForwardNote: time,
    },
  };
}

export function createProfile(input: {
  id: string;
  name: string;
  email: string;
  time?: string;
  teamId?: string | null;
  onboarded?: boolean;
}): Profile {
  const time = input.time ?? "";
  return {
    id: input.id,
    name: input.name,
    email: input.email,
    teamId: input.teamId ?? null,
    visibility: "team",
    morningReminder: "07:00",
    eveningReminder: "21:00",
    remindersEnabled: true,
    onboarded: input.onboarded ?? false,
    times: {
      name: time,
      email: time,
      teamId: time,
      visibility: time,
      morningReminder: time,
      eveningReminder: time,
      remindersEnabled: time,
      onboarded: time,
    },
  };
}

export function createNonNegotiable(id: string, label: string, time: string): NonNegotiable {
  return { id, label, deleted: false, updatedAt: time };
}

export function activeNonNegotiables(items: NonNegotiable[] | undefined): NonNegotiable[] {
  return (items ?? []).filter((item) => !item.deleted && item.label.trim());
}

export function emptyUserData(profile: Profile, time: string): UserData {
  return {
    profile,
    quarters: [],
    plans: {},
    nonNegotiables: {},
    logs: [],
    reviews: {},
    snapshots: {},
    posts: [],
    feedback: [],
    leaderRequest: null,
    teamEdits: {},
    updatedAt: time,
  };
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
}
