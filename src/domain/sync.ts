import type {
  DayLog,
  NonNegotiable,
  QuadrantId,
  QuadrantPlan,
  Quarter,
  QuarterReview,
  QuarterSnapshot,
  SyncOp,
  TeamEdit,
  UserData,
} from "../types";
import { QUADRANT_IDS } from "../types";
import { createLog, createPlan, createPlans, createReview } from "./model";

function later(incoming: string, current: string | undefined): boolean {
  return incoming > (current ?? "");
}

export function enqueueOp(queue: SyncOp[], op: SyncOp): SyncOp[] {
  const next = queue.filter(
    (item) => !(item.kind === op.kind && item.entityId === op.entityId && item.field === op.field),
  );
  next.push(op);
  return next;
}

export function mergeDayLog(base: DayLog, incoming: DayLog): DayLog {
  const out = createLog(base.date, base.quarterId, "");
  out.quarterId = later(incoming.times.quarterId, base.times.quarterId) ? incoming.quarterId : base.quarterId;
  out.times.quarterId = later(incoming.times.quarterId, base.times.quarterId)
    ? incoming.times.quarterId
    : base.times.quarterId;

  for (const quadrant of QUADRANT_IDS) {
    if (later(incoming.times.tactics[quadrant], base.times.tactics[quadrant])) {
      out.tactics[quadrant] = incoming.tactics[quadrant];
      out.times.tactics[quadrant] = incoming.times.tactics[quadrant];
    } else {
      out.tactics[quadrant] = base.tactics[quadrant];
      out.times.tactics[quadrant] = base.times.tactics[quadrant] ?? "";
    }
  }

  const nnKeys = new Set([
    ...Object.keys(base.nonNegotiables),
    ...Object.keys(incoming.nonNegotiables),
    ...Object.keys(base.times.nonNegotiables),
    ...Object.keys(incoming.times.nonNegotiables),
  ]);
  for (const key of nnKeys) {
    const baseTime = base.times.nonNegotiables[key] ?? "";
    const incomingTime = incoming.times.nonNegotiables[key] ?? "";
    if (incomingTime > baseTime) {
      out.nonNegotiables[key] = Boolean(incoming.nonNegotiables[key]);
      out.times.nonNegotiables[key] = incomingTime;
    } else if (baseTime || key in base.nonNegotiables) {
      out.nonNegotiables[key] = Boolean(base.nonNegotiables[key]);
      if (baseTime) out.times.nonNegotiables[key] = baseTime;
    }
  }

  const textFields = ["sustain", "improve", "adjust"] as const;
  for (const field of textFields) {
    if (later(incoming.times[field], base.times[field])) {
      out[field] = incoming[field];
      out.times[field] = incoming.times[field];
    } else {
      out[field] = base[field];
      out.times[field] = base.times[field];
    }
  }

  if (later(incoming.times.loggedAt, base.times.loggedAt)) {
    out.loggedAt = incoming.loggedAt;
    out.times.loggedAt = incoming.times.loggedAt;
  } else {
    out.loggedAt = base.loggedAt;
    out.times.loggedAt = base.times.loggedAt;
  }
  return out;
}

/** Union by date. A day that exists on only one side is kept. */
export function mergeLogSets(local: DayLog[], remote: DayLog[]): DayLog[] {
  const map = new Map<string, DayLog>();
  for (const log of remote) map.set(log.date, log);
  for (const log of local) {
    const other = map.get(log.date);
    map.set(log.date, other ? mergeDayLog(other, log) : log);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function reconcileLogs(local: DayLog[], remote: DayLog[]): { merged: DayLog[]; pushed: DayLog[] } {
  const merged = mergeLogSets(local, remote);
  const remoteMap = new Map(remote.map((log) => [log.date, log]));
  const pushed = merged.filter((log) => {
    const other = remoteMap.get(log.date);
    if (!other) return true;
    return JSON.stringify(other) !== JSON.stringify(log);
  });
  return { merged, pushed };
}

function mergeQuarter(base: Quarter, incoming: Quarter): Quarter {
  const out: Quarter = { ...base, times: { ...base.times } };
  const fields = ["label", "startDate", "endDate", "status", "vision", "carryForwardNote"] as const;
  for (const field of fields) {
    if (later(incoming.times[field], base.times[field])) {
      out[field] = incoming[field] as never;
      out.times[field] = incoming.times[field];
    }
  }
  return out;
}

function mergePlan(base: QuadrantPlan, incoming: QuadrantPlan): QuadrantPlan {
  const out: QuadrantPlan = { ...base, times: { ...base.times } };
  const fields = [
    "objective",
    "tactic",
    "secondaryTactic",
    "checkpoint30",
    "checkpoint60",
    "checkpoint30Done",
    "checkpoint60Done",
  ] as const;
  for (const field of fields) {
    if (later(incoming.times[field], base.times[field])) {
      out[field] = incoming[field] as never;
      out.times[field] = incoming.times[field];
    }
  }
  return out;
}

function mergePlans(base: QuadrantPlan[] | undefined, incoming: QuadrantPlan[] | undefined): QuadrantPlan[] {
  const map = new Map<string, QuadrantPlan>();
  for (const plan of base ?? []) map.set(plan.quadrant, plan);
  for (const plan of incoming ?? []) {
    const other = map.get(plan.quadrant);
    map.set(plan.quadrant, other ? mergePlan(other, plan) : plan);
  }
  return QUADRANT_IDS.map((quadrant) => map.get(quadrant) ?? createPlan(quadrant)).filter((plan) =>
    map.has(plan.quadrant),
  );
}

function mergeReview(base: QuarterReview, incoming: QuarterReview): QuarterReview {
  const out: QuarterReview = {
    ...base,
    quadrants: {
      calibration: { ...base.quadrants.calibration },
      connection: { ...base.quadrants.connection },
      condition: { ...base.quadrants.condition },
      contribution: { ...base.quadrants.contribution },
    },
    times: {
      ...base.times,
      quadrants: {
        calibration: { ...base.times.quadrants.calibration },
        connection: { ...base.times.quadrants.connection },
        condition: { ...base.times.quadrants.condition },
        contribution: { ...base.times.quadrants.contribution },
      },
    },
  };
  for (const quadrant of QUADRANT_IDS) {
    if (later(incoming.times.quadrants[quadrant].rating, base.times.quadrants[quadrant].rating)) {
      out.quadrants[quadrant].rating = incoming.quadrants[quadrant].rating;
      out.times.quadrants[quadrant].rating = incoming.times.quadrants[quadrant].rating;
    }
    if (later(incoming.times.quadrants[quadrant].notes, base.times.quadrants[quadrant].notes)) {
      out.quadrants[quadrant].notes = incoming.quadrants[quadrant].notes;
      out.times.quadrants[quadrant].notes = incoming.times.quadrants[quadrant].notes;
    }
  }
  const fields = ["sustain", "improve", "adjust", "carryForward", "closed"] as const;
  for (const field of fields) {
    if (later(incoming.times[field], base.times[field])) {
      out[field] = incoming[field] as never;
      out.times[field] = incoming.times[field];
    }
  }
  return out;
}

function mergeNonNegotiables(base: NonNegotiable[] | undefined, incoming: NonNegotiable[] | undefined): NonNegotiable[] {
  const map = new Map<string, NonNegotiable>();
  for (const item of base ?? []) map.set(item.id, item);
  for (const item of incoming ?? []) {
    const other = map.get(item.id);
    if (!other || item.updatedAt > other.updatedAt) map.set(item.id, item);
  }
  return [...map.values()];
}

function mergeTeamEdit(base: TeamEdit | undefined, incoming: TeamEdit | undefined): TeamEdit | undefined {
  if (!base) return incoming;
  if (!incoming) return base;
  const out: TeamEdit = { ...base, times: { ...base.times } };
  const fields = ["weekStartDay", "callTime", "timeZone", "leaderId"] as const;
  for (const field of fields) {
    const incomingTime = incoming.times[field] ?? "";
    const baseTime = base.times[field] ?? "";
    if (incomingTime > baseTime && incoming[field] !== undefined) {
      out[field] = incoming[field] as never;
      out.times[field] = incomingTime;
    }
  }
  return out;
}

function mergeSnapshots(
  base: Record<string, QuarterSnapshot>,
  incoming: Record<string, QuarterSnapshot>,
): Record<string, QuarterSnapshot> {
  const out = { ...base };
  for (const [id, snapshot] of Object.entries(incoming)) {
    const existing = out[id];
    if (!existing || snapshot.closedAt >= existing.closedAt) out[id] = snapshot;
  }
  return out;
}

export function mergeUser(base: UserData, incoming: UserData): UserData {
  const quarterMap = new Map<string, Quarter>();
  for (const quarter of base.quarters) quarterMap.set(quarter.id, quarter);
  for (const quarter of incoming.quarters) {
    const other = quarterMap.get(quarter.id);
    quarterMap.set(quarter.id, other ? mergeQuarter(other, quarter) : quarter);
  }
  const quarters = [...quarterMap.values()].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

  const plans: UserData["plans"] = {};
  const nonNegotiables: UserData["nonNegotiables"] = {};
  const reviews: UserData["reviews"] = {};
  const ids = new Set([
    ...Object.keys(base.plans),
    ...Object.keys(incoming.plans),
    ...Object.keys(base.nonNegotiables),
    ...Object.keys(incoming.nonNegotiables),
    ...Object.keys(base.reviews),
    ...Object.keys(incoming.reviews),
    ...quarters.map((quarter) => quarter.id),
  ]);
  for (const id of ids) {
    if (base.plans[id] || incoming.plans[id]) plans[id] = mergePlans(base.plans[id], incoming.plans[id]);
    if (base.nonNegotiables[id] || incoming.nonNegotiables[id]) {
      nonNegotiables[id] = mergeNonNegotiables(base.nonNegotiables[id], incoming.nonNegotiables[id]);
    }
    if (base.reviews[id] || incoming.reviews[id]) {
      reviews[id] = mergeReview(base.reviews[id] ?? createReview(), incoming.reviews[id] ?? createReview());
    }
  }

  const profile = { ...base.profile, times: { ...base.profile.times } };
  const profileFields = [
    "name",
    "email",
    "teamId",
    "visibility",
    "morningReminder",
    "eveningReminder",
    "remindersEnabled",
    "onboarded",
  ] as const;
  for (const field of profileFields) {
    if (later(incoming.profile.times[field], base.profile.times[field])) {
      profile[field] = incoming.profile[field] as never;
      profile.times[field] = incoming.profile.times[field];
    }
  }

  const posts = new Map(base.posts.map((post) => [post.id, post]));
  for (const post of incoming.posts) posts.set(post.id, post);
  const feedback = new Map(base.feedback.map((item) => [item.id, item]));
  for (const item of incoming.feedback) feedback.set(item.id, item);

  const teamEdits: Record<string, TeamEdit> = { ...base.teamEdits };
  for (const [id, edit] of Object.entries(incoming.teamEdits)) {
    const merged = mergeTeamEdit(teamEdits[id], edit);
    if (merged) teamEdits[id] = merged;
  }

  const leaderRequest =
    incoming.leaderRequest &&
    (!base.leaderRequest || incoming.leaderRequest.createdAt > base.leaderRequest.createdAt)
      ? incoming.leaderRequest
      : base.leaderRequest;

  return {
    profile,
    quarters,
    plans,
    nonNegotiables,
    logs: mergeLogSets(incoming.logs, base.logs),
    reviews,
    snapshots: mergeSnapshots(base.snapshots, incoming.snapshots),
    posts: [...posts.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    feedback: [...feedback.values()],
    leaderRequest,
    teamEdits,
    updatedAt: incoming.updatedAt > base.updatedAt ? incoming.updatedAt : base.updatedAt,
  };
}

function ensureQuarterPlans(data: UserData, quarterId: string): QuadrantPlan[] {
  if (!data.plans[quarterId]) data.plans[quarterId] = createPlans();
  for (const quadrant of QUADRANT_IDS) {
    if (!data.plans[quarterId].some((plan) => plan.quadrant === quadrant)) {
      data.plans[quarterId].push(createPlan(quadrant));
    }
  }
  return data.plans[quarterId];
}

export function applyOp(data: UserData, op: SyncOp): UserData {
  const next: UserData = {
    ...data,
    profile: { ...data.profile, times: { ...data.profile.times } },
    quarters: data.quarters.map((quarter) => ({ ...quarter, times: { ...quarter.times } })),
    plans: Object.fromEntries(
      Object.entries(data.plans).map(([id, plans]) => [id, plans.map((plan) => ({ ...plan, times: { ...plan.times } }))]),
    ),
    nonNegotiables: Object.fromEntries(Object.entries(data.nonNegotiables).map(([id, items]) => [id, items.map((item) => ({ ...item }))])),
    logs: data.logs.map((log) => ({
      ...log,
      tactics: { ...log.tactics },
      nonNegotiables: { ...log.nonNegotiables },
      times: {
        ...log.times,
        tactics: { ...log.times.tactics },
        nonNegotiables: { ...log.times.nonNegotiables },
      },
    })),
    reviews: Object.fromEntries(
      Object.entries(data.reviews).map(([id, review]) => [
        id,
        {
          ...review,
          quadrants: {
            calibration: { ...review.quadrants.calibration },
            connection: { ...review.quadrants.connection },
            condition: { ...review.quadrants.condition },
            contribution: { ...review.quadrants.contribution },
          },
          times: {
            ...review.times,
            quadrants: {
              calibration: { ...review.times.quadrants.calibration },
              connection: { ...review.times.quadrants.connection },
              condition: { ...review.times.quadrants.condition },
              contribution: { ...review.times.quadrants.contribution },
            },
          },
        },
      ]),
    ),
    snapshots: { ...data.snapshots },
    posts: [...data.posts],
    feedback: [...data.feedback],
    teamEdits: { ...data.teamEdits },
  };

  if (op.kind === "log-field") {
    let log = next.logs.find((item) => item.date === op.entityId);
    if (!log) {
      log = createLog(op.entityId, op.quarterId ?? "", "");
      next.logs.push(log);
      next.logs.sort((a, b) => (a.date < b.date ? -1 : 1));
    }
    const [group, key] = op.field.split(".");
    if (group === "tactics" && key && later(op.updatedAt, log.times.tactics[key as QuadrantId])) {
      log.tactics[key as QuadrantId] = Boolean(op.value);
      log.times.tactics[key as QuadrantId] = op.updatedAt;
    } else if (group === "nn" && key && later(op.updatedAt, log.times.nonNegotiables[key])) {
      log.nonNegotiables[key] = Boolean(op.value);
      log.times.nonNegotiables[key] = op.updatedAt;
    } else if ((group === "sustain" || group === "improve" || group === "adjust") && later(op.updatedAt, log.times[group])) {
      log[group] = String(op.value ?? "");
      log.times[group] = op.updatedAt;
    } else if (group === "loggedAt" && later(op.updatedAt, log.times.loggedAt)) {
      log.loggedAt = op.value ? String(op.value) : null;
      log.times.loggedAt = op.updatedAt;
    } else if (group === "quarterId" && later(op.updatedAt, log.times.quarterId)) {
      log.quarterId = String(op.value ?? "");
      log.times.quarterId = op.updatedAt;
    }
    return next;
  }

  if (op.kind === "quarter-field") {
    const quarter = next.quarters.find((item) => item.id === op.entityId);
    if (!quarter) return next;
    const field = op.field as keyof Quarter["times"];
    if (field in quarter.times && later(op.updatedAt, quarter.times[field])) {
      quarter[field] = op.value as never;
      quarter.times[field] = op.updatedAt;
    }
    return next;
  }

  if (op.kind === "plan-field") {
    const [quarterId, quadrant] = op.entityId.split(":");
    const plans = ensureQuarterPlans(next, quarterId);
    const plan = plans.find((item) => item.quadrant === (quadrant as QuadrantId));
    if (!plan) return next;
    const field = op.field as keyof QuadrantPlan["times"];
    if (field in plan.times && later(op.updatedAt, plan.times[field])) {
      plan[field] = op.value as never;
      plan.times[field] = op.updatedAt;
    }
    return next;
  }

  if (op.kind === "review-field") {
    if (!next.reviews[op.entityId]) next.reviews[op.entityId] = createReview();
    const review = next.reviews[op.entityId];
    const [group, quadrant, leaf] = op.field.split(".");
    if (group === "quadrant" && quadrant && (leaf === "rating" || leaf === "notes")) {
      const id = quadrant as QuadrantId;
      if (later(op.updatedAt, review.times.quadrants[id][leaf])) {
        review.quadrants[id][leaf] = op.value as never;
        review.times.quadrants[id][leaf] = op.updatedAt;
      }
    } else if (
      (group === "sustain" || group === "improve" || group === "adjust" || group === "carryForward" || group === "closed") &&
      later(op.updatedAt, review.times[group])
    ) {
      review[group] = op.value as never;
      review.times[group] = op.updatedAt;
    }
    return next;
  }

  if (op.kind === "nn") {
    const items = next.nonNegotiables[op.entityId] ? [...next.nonNegotiables[op.entityId]] : [];
    const value = op.value as { label: string; deleted: boolean };
    const index = items.findIndex((item) => item.id === op.field);
    if (index === -1) {
      items.push({ id: op.field, label: value.label, deleted: Boolean(value.deleted), updatedAt: op.updatedAt });
    } else if (op.updatedAt > items[index].updatedAt) {
      items[index] = { id: op.field, label: value.label, deleted: Boolean(value.deleted), updatedAt: op.updatedAt };
    }
    next.nonNegotiables[op.entityId] = items;
    return next;
  }

  if (op.kind === "profile-field") {
    const field = op.field as keyof UserData["profile"]["times"];
    if (field in next.profile.times && later(op.updatedAt, next.profile.times[field])) {
      next.profile[field] = op.value as never;
      next.profile.times[field] = op.updatedAt;
    }
    return next;
  }

  if (op.kind === "post") {
    const post = op.value as UserData["posts"][number];
    if (!next.posts.some((item) => item.id === post.id)) next.posts = [post, ...next.posts];
    return next;
  }

  if (op.kind === "feedback") {
    const item = op.value as UserData["feedback"][number];
    if (!next.feedback.some((entry) => entry.id === item.id)) next.feedback = [...next.feedback, item];
    return next;
  }

  if (op.kind === "team") {
    const edit = op.value as TeamEdit;
    next.teamEdits[op.entityId] = mergeTeamEdit(next.teamEdits[op.entityId], edit) ?? edit;
    return next;
  }

  if (op.kind === "snapshot") {
    const snapshot = op.value as QuarterSnapshot;
    const existing = next.snapshots[snapshot.quarterId];
    if (!existing || snapshot.closedAt >= existing.closedAt) next.snapshots[snapshot.quarterId] = snapshot;
    return next;
  }

  if (op.kind === "leader") {
    const request = op.value as UserData["leaderRequest"];
    if (request && (!next.leaderRequest || request.createdAt > next.leaderRequest.createdAt)) {
      next.leaderRequest = request;
    }
    return next;
  }

  return next;
}

export function applyOps(data: UserData, ops: SyncOp[]): UserData {
  return ops.reduce((current, op) => applyOp(current, op), data);
}

export interface FlushResult {
  remote: UserData;
  remaining: SyncOp[];
  applied: number;
}

/** Apply the durable queue onto the last known remote copy. A failing op stops the flush and stays queued. */
export function flushQueue(remote: UserData, queue: SyncOp[], shouldFail?: (op: SyncOp) => boolean): FlushResult {
  let next = remote;
  const remaining: SyncOp[] = [];
  let applied = 0;
  let blocked = false;
  for (const op of queue) {
    if (blocked || shouldFail?.(op)) {
      blocked = true;
      remaining.push(op);
      continue;
    }
    next = applyOp(next, op);
    applied += 1;
  }
  return { remote: next, remaining, applied };
}
