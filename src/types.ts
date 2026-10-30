export const QUADRANT_IDS = ["calibration", "connection", "condition", "contribution"] as const;
export type QuadrantId = (typeof QUADRANT_IDS)[number];

export type QuarterStatus = "active" | "draft" | "closed";
export type Rating = "hit" | "partial" | "missed";
export type Visibility = "everyone" | "team" | "private";
export type FeedbackKind = "idea" | "bug" | "other";

export interface Quarter {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: QuarterStatus;
  vision: string;
  carryForwardNote: string;
  times: {
    label: string;
    startDate: string;
    endDate: string;
    status: string;
    vision: string;
    carryForwardNote: string;
  };
}

export interface QuadrantPlan {
  quadrant: QuadrantId;
  objective: string;
  tactic: string;
  secondaryTactic: string;
  checkpoint30: string;
  checkpoint60: string;
  checkpoint30Done: boolean;
  checkpoint60Done: boolean;
  times: {
    objective: string;
    tactic: string;
    secondaryTactic: string;
    checkpoint30: string;
    checkpoint60: string;
    checkpoint30Done: string;
    checkpoint60Done: string;
  };
}

export interface NonNegotiable {
  id: string;
  label: string;
  deleted: boolean;
  updatedAt: string;
}

export interface DayLog {
  date: string;
  quarterId: string;
  tactics: Record<QuadrantId, boolean>;
  nonNegotiables: Record<string, boolean>;
  sustain: string;
  improve: string;
  adjust: string;
  loggedAt: string | null;
  times: {
    quarterId: string;
    tactics: Record<QuadrantId, string>;
    nonNegotiables: Record<string, string>;
    sustain: string;
    improve: string;
    adjust: string;
    loggedAt: string;
  };
}

export interface QuadrantReview {
  rating: Rating | null;
  notes: string;
}

export interface QuarterReview {
  quadrants: Record<QuadrantId, QuadrantReview>;
  sustain: string;
  improve: string;
  adjust: string;
  carryForward: string;
  closed: boolean;
  times: {
    quadrants: Record<QuadrantId, { rating: string; notes: string }>;
    sustain: string;
    improve: string;
    adjust: string;
    carryForward: string;
    closed: string;
  };
}

export interface QuarterSnapshot {
  quarterId: string;
  points: number;
  fullFours: number;
  bestStreak: number;
  streakAtClose: number;
  daysLogged: number;
  execution: Record<QuadrantId, number>;
  teamRank: number | null;
  councilRank: number | null;
  teamSize: number;
  councilSize: number;
  badges: string[];
  closedAt: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  teamId: string | null;
  visibility: Visibility;
  morningReminder: string;
  eveningReminder: string;
  remindersEnabled: boolean;
  onboarded: boolean;
  times: {
    name: string;
    email: string;
    teamId: string;
    visibility: string;
    morningReminder: string;
    eveningReminder: string;
    remindersEnabled: string;
    onboarded: string;
  };
}

/** 0 = Sunday … 6 = Saturday. This is the weekly team-call day and the week start. */
export interface Team {
  id: string;
  name: string;
  blurb: string;
  weekStartDay: number;
  callTime: string;
  timeZone: string;
  leaderId: string | null;
  leaderName: string;
}

export interface TeamEdit {
  weekStartDay?: number;
  callTime?: string;
  timeZone?: string;
  leaderId?: string | null;
  times: {
    weekStartDay?: string;
    callTime?: string;
    timeZone?: string;
    leaderId?: string;
  };
}

export interface BoardPost {
  id: string;
  teamId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  body: string;
  createdAt: string;
}

export interface LeaderRequest {
  teamId: string;
  status: "pending";
  createdAt: string;
}

export interface UserData {
  profile: Profile;
  quarters: Quarter[];
  plans: Record<string, QuadrantPlan[]>;
  nonNegotiables: Record<string, NonNegotiable[]>;
  logs: DayLog[];
  reviews: Record<string, QuarterReview>;
  snapshots: Record<string, QuarterSnapshot>;
  posts: BoardPost[];
  feedback: FeedbackItem[];
  leaderRequest: LeaderRequest | null;
  teamEdits: Record<string, TeamEdit>;
  updatedAt: string;
}

export interface SampleMember {
  userId: string;
  name: string;
  teamId: string;
  visibility: "everyone" | "team" | "private";
  pointsByQuarter: Record<string, number>;
  daysLogged: number;
  fullFours: number;
  streak: number;
  badges: string[];
  eveningLogs: number;
}

export type SyncKind =
  | "log-field"
  | "plan-field"
  | "quarter-field"
  | "review-field"
  | "nn"
  | "profile-field"
  | "post"
  | "feedback"
  | "team"
  | "snapshot"
  | "leader";

export interface SyncOp {
  id: string;
  kind: SyncKind;
  entityId: string;
  field: string;
  value: unknown;
  updatedAt: string;
  /** Required for log-field ops so a brand-new day can be created. */
  quarterId?: string;
}
