import { summarizeQuarter } from "../domain/stats";
import type { DayLog, QuadrantPlan, UserData } from "../types";
import { QUADRANT_IDS } from "../types";
import { supabase } from "./supabase";

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function pullUser(userId: string): Promise<Partial<UserData> | null> {
  const db = client();
  const [profile, quarters, logs, reviews, snapshots, posts, feedback, leader] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).maybeSingle(),
    db.from("quarters").select("*").eq("user_id", userId),
    db.from("day_logs").select("*").eq("user_id", userId),
    db.from("reviews").select("*, quarters!inner(user_id)").eq("quarters.user_id", userId),
    db.from("quarter_snapshots").select("*, quarters!inner(user_id)").eq("quarters.user_id", userId),
    db.from("board_posts").select("*").eq("user_id", userId),
    db.from("feedback").select("*").eq("user_id", userId),
    db.from("leader_requests").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (!profile.data) return null;
  const quarterRows = quarters.data ?? [];
  const ids = quarterRows.map((row) => row.id as string);
  const [plans, nns] = ids.length
    ? await Promise.all([
        db.from("quadrant_plans").select("*").in("quarter_id", ids),
        db.from("non_negotiables").select("*").in("quarter_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const mappedQuarters = quarterRows.map(mapQuarter);
  const planMap: UserData["plans"] = {};
  for (const row of plans.data ?? []) {
    const plan = mapPlan(row);
    planMap[row.quarter_id] = [...(planMap[row.quarter_id] ?? []), plan];
  }
  const nnMap: UserData["nonNegotiables"] = {};
  for (const row of nns.data ?? []) {
    nnMap[row.quarter_id] = [
      ...(nnMap[row.quarter_id] ?? []),
      { id: row.id, label: row.label, deleted: Boolean(row.deleted), updatedAt: row.updated_at },
    ];
  }
  const reviewMap: UserData["reviews"] = {};
  for (const row of reviews.data ?? []) reviewMap[row.quarter_id] = mapReview(row);
  const snapshotMap: UserData["snapshots"] = {};
  for (const row of snapshots.data ?? []) snapshotMap[row.quarter_id] = mapSnapshot(row);

  return {
    profile: {
      id: profile.data.id,
      name: profile.data.display_name,
      email: "",
      teamId: profile.data.team_id,
      visibility: profile.data.visibility,
      morningReminder: profile.data.morning_reminder,
      eveningReminder: profile.data.evening_reminder,
      remindersEnabled: profile.data.reminders_enabled,
      onboarded: profile.data.onboarded,
      times: profile.data.field_times ?? blankProfileTimes(),
    },
    quarters: mappedQuarters,
    plans: planMap,
    nonNegotiables: nnMap,
    logs: (logs.data ?? []).map(mapLog),
    reviews: reviewMap,
    snapshots: snapshotMap,
    posts: (posts.data ?? []).map(mapPost),
    feedback: (feedback.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      body: row.body,
      createdAt: row.created_at,
    })),
    leaderRequest: leader.data
      ? { teamId: leader.data.team_id, status: "pending", createdAt: leader.data.created_at }
      : null,
  };
}

export async function pushUser(userId: string, data: UserData, today: string): Promise<void> {
  const db = client();
  const profile = data.profile;
  const profileWrite = await db.from("profiles").upsert({
    id: userId,
    display_name: profile.name,
    team_id: profile.teamId,
    visibility: profile.visibility,
    morning_reminder: profile.morningReminder,
    evening_reminder: profile.eveningReminder,
    reminders_enabled: profile.remindersEnabled,
    onboarded: profile.onboarded,
    field_times: profile.times,
    updated_at: data.updatedAt,
  });
  if (profileWrite.error) throw profileWrite.error;

  if (data.quarters.length) {
    const quarterWrite = await db.from("quarters").upsert(
      data.quarters.map((quarter) => ({
        id: quarter.id,
        user_id: userId,
        label: quarter.label,
        start_date: quarter.startDate,
        end_date: quarter.endDate,
        status: quarter.status,
        vision: quarter.vision,
        carry_forward_note: quarter.carryForwardNote,
        field_times: quarter.times,
        updated_at: data.updatedAt,
      })),
    );
    if (quarterWrite.error) throw quarterWrite.error;
  }

  const planRows = data.quarters.flatMap((quarter) =>
    (data.plans[quarter.id] ?? []).map((plan) => ({
      quarter_id: quarter.id,
      quadrant: plan.quadrant,
      objective: plan.objective,
      tactic: plan.tactic,
      secondary_tactic: plan.secondaryTactic,
      checkpoint_30: plan.checkpoint30,
      checkpoint_60: plan.checkpoint60,
      checkpoint_30_done: plan.checkpoint30Done,
      checkpoint_60_done: plan.checkpoint60Done,
      field_times: plan.times,
    })),
  );
  if (planRows.length) {
    const planWrite = await db.from("quadrant_plans").upsert(planRows);
    if (planWrite.error) throw planWrite.error;
  }

  for (const quarter of data.quarters) {
    const items = data.nonNegotiables[quarter.id] ?? [];
    if (!items.length) continue;
    const nnWrite = await db.from("non_negotiables").upsert(
      items.map((item, index) => ({
        id: item.id,
        quarter_id: quarter.id,
        position: index + 1,
        label: item.label,
        deleted: item.deleted,
        updated_at: item.updatedAt,
      })),
    );
    if (nnWrite.error) throw nnWrite.error;
  }

  if (data.logs.length) {
    const logWrite = await db.from("day_logs").upsert(
      data.logs.map((log) => ({
        user_id: userId,
        quarter_id: log.quarterId,
        log_date: log.date,
        tactic_calibration: log.tactics.calibration,
        tactic_connection: log.tactics.connection,
        tactic_condition: log.tactics.condition,
        tactic_contribution: log.tactics.contribution,
        non_negotiable_checks: log.nonNegotiables,
        sustain: log.sustain,
        improve: log.improve,
        adjust: log.adjust,
        logged_at: log.loggedAt,
        field_times: log.times,
      })),
      { onConflict: "user_id,log_date" },
    );
    if (logWrite.error) throw logWrite.error;
  }

  const reviewRows = Object.entries(data.reviews).map(([quarterId, review]) => ({
    quarter_id: quarterId,
    calibration_rating: review.quadrants.calibration.rating,
    calibration_notes: review.quadrants.calibration.notes,
    connection_rating: review.quadrants.connection.rating,
    connection_notes: review.quadrants.connection.notes,
    condition_rating: review.quadrants.condition.rating,
    condition_notes: review.quadrants.condition.notes,
    contribution_rating: review.quadrants.contribution.rating,
    contribution_notes: review.quadrants.contribution.notes,
    sustain: review.sustain,
    improve: review.improve,
    adjust: review.adjust,
    carry_forward: review.carryForward,
    closed: review.closed,
    field_times: review.times,
    updated_at: data.updatedAt,
  }));
  if (reviewRows.length) {
    const reviewWrite = await db.from("reviews").upsert(reviewRows);
    if (reviewWrite.error) throw reviewWrite.error;
  }

  const snapshotRows = Object.values(data.snapshots).map((snapshot) => ({
    quarter_id: snapshot.quarterId,
    points: snapshot.points,
    full_fours: snapshot.fullFours,
    best_streak: snapshot.bestStreak,
    streak_at_close: snapshot.streakAtClose,
    days_logged: snapshot.daysLogged,
    execution: snapshot.execution,
    team_rank: snapshot.teamRank,
    council_rank: snapshot.councilRank,
    team_size: snapshot.teamSize,
    council_size: snapshot.councilSize,
    badges: snapshot.badges,
    closed_at: snapshot.closedAt,
  }));
  if (snapshotRows.length) {
    const snapshotWrite = await db.from("quarter_snapshots").upsert(snapshotRows);
    if (snapshotWrite.error) throw snapshotWrite.error;
  }

  const statRows = data.quarters
    .filter((quarter) => quarter.status !== "draft")
    .map((quarter) => {
      const stats = summarizeQuarter({
        quarter,
        logs: data.logs,
        nonNegotiables: data.nonNegotiables[quarter.id] ?? [],
        plans: data.plans[quarter.id] ?? [],
        review: data.reviews[quarter.id],
        today,
      });
      return {
        user_id: userId,
        quarter_id: quarter.id,
        quarter_label: quarter.label,
        points: stats.points,
        days_logged: stats.daysLogged,
        full_fours: stats.fullFours,
        current_streak: stats.currentStreak,
        badges: stats.badges,
        evening_logs: stats.eveningLogs,
        recent: recentScores(data.logs, quarter.id),
        updated_at: data.updatedAt,
      };
    });
  if (statRows.length) {
    const statsWrite = await db.from("public_stats").upsert(statRows);
    if (statsWrite.error) throw statsWrite.error;
  }

  for (const [teamId, edit] of Object.entries(data.teamEdits)) {
    if (edit.leaderId && edit.leaderId !== userId) continue;
    const teamWrite = await db
      .from("teams")
      .update({
        week_start_day: edit.weekStartDay,
        call_time: edit.callTime,
        time_zone: edit.timeZone,
      })
      .eq("id", teamId)
      .eq("leader_id", userId);
    if (teamWrite.error) throw teamWrite.error;
  }

  if (data.posts.length) {
    const postWrite = await db.from("board_posts").upsert(
      data.posts
        .filter((post) => post.authorId === userId)
        .map((post) => ({
          id: post.id,
          team_id: post.teamId,
          user_id: userId,
          author_name: post.authorName,
          body: post.body,
          created_at: post.createdAt,
        })),
    );
    if (postWrite.error) throw postWrite.error;
  }

  if (data.feedback.length) {
    const feedbackWrite = await db.from("feedback").upsert(
      data.feedback.map((item) => ({
        id: item.id,
        user_id: userId,
        kind: item.kind,
        body: item.body,
        created_at: item.createdAt,
      })),
    );
    if (feedbackWrite.error) throw feedbackWrite.error;
  }

  if (data.leaderRequest) {
    const leadWrite = await db.from("leader_requests").upsert({
      team_id: data.leaderRequest.teamId,
      user_id: userId,
      status: "pending",
      created_at: data.leaderRequest.createdAt,
    });
    if (leadWrite.error) throw leadWrite.error;
  }
}

function recentScores(logs: DayLog[], quarterId: string) {
  return logs
    .filter((log) => log.quarterId === quarterId)
    .slice(-14)
    .map((log) => ({
      date: log.date,
      score: QUADRANT_IDS.filter((quadrant) => log.tactics[quadrant]).length,
    }));
}

function blankProfileTimes() {
  const time = "";
  return {
    name: time,
    email: time,
    teamId: time,
    visibility: time,
    morningReminder: time,
    eveningReminder: time,
    remindersEnabled: time,
    onboarded: time,
  };
}

function mapQuarter(row: Record<string, any>) {
  const times = row.field_times ?? {};
  return {
    id: row.id,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    vision: row.vision ?? "",
    carryForwardNote: row.carry_forward_note ?? "",
    times: {
      label: times.label ?? row.updated_at,
      startDate: times.startDate ?? row.updated_at,
      endDate: times.endDate ?? row.updated_at,
      status: times.status ?? row.updated_at,
      vision: times.vision ?? row.updated_at,
      carryForwardNote: times.carryForwardNote ?? row.updated_at,
    },
  };
}

function mapPlan(row: Record<string, any>): QuadrantPlan {
  const times = row.field_times ?? {};
  const stamp = row.updated_at ?? "";
  return {
    quadrant: row.quadrant,
    objective: row.objective ?? "",
    tactic: row.tactic ?? "",
    secondaryTactic: row.secondary_tactic ?? "",
    checkpoint30: row.checkpoint_30 ?? "",
    checkpoint60: row.checkpoint_60 ?? "",
    checkpoint30Done: Boolean(row.checkpoint_30_done),
    checkpoint60Done: Boolean(row.checkpoint_60_done),
    times: {
      objective: times.objective ?? stamp,
      tactic: times.tactic ?? stamp,
      secondaryTactic: times.secondaryTactic ?? stamp,
      checkpoint30: times.checkpoint30 ?? stamp,
      checkpoint60: times.checkpoint60 ?? stamp,
      checkpoint30Done: times.checkpoint30Done ?? stamp,
      checkpoint60Done: times.checkpoint60Done ?? stamp,
    },
  };
}

function mapLog(row: Record<string, any>): DayLog {
  const times = row.field_times;
  const log: DayLog = {
    date: row.log_date,
    quarterId: row.quarter_id,
    tactics: {
      calibration: Boolean(row.tactic_calibration),
      connection: Boolean(row.tactic_connection),
      condition: Boolean(row.tactic_condition),
      contribution: Boolean(row.tactic_contribution),
    },
    nonNegotiables: row.non_negotiable_checks ?? {},
    sustain: row.sustain ?? "",
    improve: row.improve ?? "",
    adjust: row.adjust ?? "",
    loggedAt: row.logged_at,
    times: times ?? {
      quarterId: row.logged_at ?? "",
      tactics: {
        calibration: row.logged_at ?? "",
        connection: row.logged_at ?? "",
        condition: row.logged_at ?? "",
        contribution: row.logged_at ?? "",
      },
      nonNegotiables: {},
      sustain: row.logged_at ?? "",
      improve: row.logged_at ?? "",
      adjust: row.logged_at ?? "",
      loggedAt: row.logged_at ?? "",
    },
  };
  return log;
}

function mapReview(row: Record<string, any>) {
  const times = row.field_times;
  const stamp = row.updated_at ?? "";
  const quadrant = (rating: string | null, notes: string, key: string) => ({
    rating: rating as "hit" | "partial" | "missed" | null,
    notes: notes ?? "",
    time: times?.quadrants?.[key] ?? { rating: stamp, notes: stamp },
  });
  const c = quadrant(row.calibration_rating, row.calibration_notes, "calibration");
  const n = quadrant(row.connection_rating, row.connection_notes, "connection");
  const d = quadrant(row.condition_rating, row.condition_notes, "condition");
  const b = quadrant(row.contribution_rating, row.contribution_notes, "contribution");
  return {
    quadrants: {
      calibration: { rating: c.rating, notes: c.notes },
      connection: { rating: n.rating, notes: n.notes },
      condition: { rating: d.rating, notes: d.notes },
      contribution: { rating: b.rating, notes: b.notes },
    },
    sustain: row.sustain ?? "",
    improve: row.improve ?? "",
    adjust: row.adjust ?? "",
    carryForward: row.carry_forward ?? "",
    closed: Boolean(row.closed),
    times: times ?? {
      quadrants: {
        calibration: { rating: stamp, notes: stamp },
        connection: { rating: stamp, notes: stamp },
        condition: { rating: stamp, notes: stamp },
        contribution: { rating: stamp, notes: stamp },
      },
      sustain: stamp,
      improve: stamp,
      adjust: stamp,
      carryForward: stamp,
      closed: stamp,
    },
  };
}

function mapSnapshot(row: Record<string, any>) {
  return {
    quarterId: row.quarter_id,
    points: row.points,
    fullFours: row.full_fours,
    bestStreak: row.best_streak,
    streakAtClose: row.streak_at_close,
    daysLogged: row.days_logged,
    execution: row.execution,
    teamRank: row.team_rank,
    councilRank: row.council_rank,
    teamSize: row.team_size,
    councilSize: row.council_size,
    badges: row.badges ?? [],
    closedAt: row.closed_at,
  };
}

function mapPost(row: Record<string, any>) {
  return {
    id: row.id,
    teamId: row.team_id,
    authorId: row.user_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}
