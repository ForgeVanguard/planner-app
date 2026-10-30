import { DEMO_EMAIL, DEMO_USER_ID } from "../config";
import { buildSnapshot, sampleRow, summarizeQuarter, visibleStandings, type StandingRow } from "../domain/stats";
import { addDays, enumerateDays } from "../domain/dates";
import { createLog, createNonNegotiable, createPlans, createProfile, createQuarter, createReview } from "../domain/model";
import { dayCountsForStreak } from "../domain/scoring";
import type { DayLog, QuadrantId, QuadrantPlan, Quarter, UserData } from "../types";
import { QUADRANT_IDS } from "../types";
import { SAMPLE_MEMBERS } from "./catalog";

const STAMP = "2026-10-01T15:00:00.000Z";

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fillPlan(plan: QuadrantPlan, fields: Partial<QuadrantPlan>, time: string): QuadrantPlan {
  const next = { ...plan, times: { ...plan.times } };
  for (const key of Object.keys(fields) as (keyof QuadrantPlan)[]) {
    if (key === "times" || key === "quadrant") continue;
    next[key] = fields[key] as never;
    if (key in next.times) next.times[key as keyof QuadrantPlan["times"]] = time;
  }
  return next;
}

function plansFrom(
  rows: Record<QuadrantId, Partial<QuadrantPlan>>,
  time: string,
): QuadrantPlan[] {
  return createPlans(time).map((plan) => fillPlan(plan, rows[plan.quadrant], time));
}

const Q4_PLANS: Record<QuadrantId, Partial<QuadrantPlan>> = {
  calibration: {
    objective: "Begin every weekday in silence before I touch a screen, and finish one book this quarter.",
    tactic: "Ten quiet minutes, then twenty pages, before email.",
    secondaryTactic: "Write one sentence about what I noticed.",
    checkpoint30: "The silence is in place on weekdays. Name the book and how far I am.",
    checkpoint60: "The book is finished, or I can say plainly why it is not.",
  },
  connection: {
    objective: "Put the phone away and actually talk to my partner every night.",
    tactic: "Twenty undistracted minutes together after dinner.",
    secondaryTactic: "Send one real message to a friend I have been putting off.",
    checkpoint30: "We have not missed a weeknight conversation in the last two weeks.",
    checkpoint60: "Name one friendship that is warmer than it was on day one.",
  },
  condition: {
    objective: "Train four days a week and protect a consistent sleep window.",
    tactic: "Thirty minutes of lifting or a hard walk.",
    secondaryTactic: "In bed with the lights out by 10:30.",
    checkpoint30: "Four training weeks logged, and the bedtime is mostly true.",
    checkpoint60: "Sleep is boring. Training is still four days.",
  },
  contribution: {
    objective: "Finish the client proposal and look at the money every week.",
    tactic: "Ninety protected minutes on the most important work.",
    secondaryTactic: "Record the day's expenses before dinner.",
    checkpoint30: "The proposal outline is in the client's hands, even if it is still rough.",
    checkpoint60: "The proposal is sent. The weekly money check has not slipped.",
  },
};

const Q3_PLANS: Record<QuadrantId, Partial<QuadrantPlan>> = {
  calibration: {
    objective: "A morning page and one afternoon without a podcast.",
    tactic: "Write a page before breakfast.",
    secondaryTactic: "One walk with nothing in my ears.",
    checkpoint30: "Pages happened. The quiet walk did not.",
    checkpoint60: "The walk finally stuck on Sundays.",
    checkpoint30Done: true,
    checkpoint60Done: true,
  },
  connection: {
    objective: "Call my brother every Sunday.",
    tactic: "A ten-minute call, not a text.",
    secondaryTactic: "Ask one question and then stop talking.",
    checkpoint30: "Missed two Sundays while traveling.",
    checkpoint60: "The last month of calls actually happened.",
    checkpoint30Done: true,
    checkpoint60Done: true,
  },
  condition: {
    objective: "Lift three days and stop eating lunch at the desk.",
    tactic: "A short lift or a set of carries.",
    secondaryTactic: "Lunch away from the keyboard.",
    checkpoint30: "Lifts were inconsistent. Lunch moved.",
    checkpoint60: "Three lifting days became normal.",
    checkpoint30Done: true,
    checkpoint60Done: true,
  },
  contribution: {
    objective: "Close the small invoices within a week.",
    tactic: "Send or chase one invoice before noon.",
    secondaryTactic: "Leave the shop with tomorrow's first task written down.",
    checkpoint30: "Invoices were still late.",
    checkpoint60: "The pile was gone.",
    checkpoint30Done: true,
    checkpoint60Done: true,
  },
};

const Q2_PLANS: Record<QuadrantId, Partial<QuadrantPlan>> = {
  calibration: {
    objective: "Get back to a weekly service and a short reading habit.",
    tactic: "Read ten minutes at night.",
    secondaryTactic: "Be at the service, not just near it.",
    checkpoint30: "Reading happened. Attendance was spotty.",
    checkpoint60: "Both were ordinary by the end.",
    checkpoint30Done: true,
    checkpoint60Done: true,
  },
  connection: {
    objective: "Eat dinner at the table four nights a week.",
    tactic: "Sit down together, even if the meal is simple.",
    secondaryTactic: "No screens at the table.",
    checkpoint30: "Two nights, not four.",
    checkpoint60: "Four nights became the default.",
    checkpoint30Done: true,
    checkpoint60Done: true,
  },
  condition: {
    objective: "Walk every day and see a doctor I had been avoiding.",
    tactic: "A twenty-minute walk.",
    secondaryTactic: "Book the appointment and go.",
    checkpoint30: "The walk was real. The appointment was still a rumor.",
    checkpoint60: "I went.",
    checkpoint30Done: true,
    checkpoint60Done: true,
  },
  contribution: {
    objective: "Say no to one project that was only pride.",
    tactic: "One hour on the work that pays the bills.",
    secondaryTactic: "Write down the no before I soften it.",
    checkpoint30: "I had not said the no yet.",
    checkpoint60: "The no was sent.",
    checkpoint30Done: true,
    checkpoint60Done: true,
  },
};

function nn(ids: string[], labels: string[], time: string) {
  return labels.map((label, index) => createNonNegotiable(ids[index], label, time));
}

const NN_LABELS = [
  "Make the bed",
  "No phone for the first half hour",
  "Protein at breakfast",
  "Get outside in daylight",
  "Tell the truth in the debrief",
  "Lights out by 10:30",
];

function nnIds(prefix: string): string[] {
  return NN_LABELS.map((_, index) => `${prefix}-nn-${index + 1}`);
}

function synthesize(quarter: Quarter, ids: string[], through: string, skip: string[], debriefDays: Record<string, [string, string, string]>, time: string): DayLog[] {
  const logs: DayLog[] = [];
  for (const date of enumerateDays(quarter.startDate, through)) {
    if (skip.includes(date) || date > through) continue;
    const h = hash(`${quarter.id}:${date}`);
    const log = createLog(date, quarter.id, time);
    log.tactics = {
      calibration: h % 5 !== 0,
      connection: h % 7 !== 0,
      condition: h % 4 !== 0,
      contribution: h % 6 !== 0,
    };
    log.times.tactics = {
      calibration: time,
      connection: time,
      condition: time,
      contribution: time,
    };
    ids.forEach((id, index) => {
      const checked = (h >> index) % 3 !== 0;
      log.nonNegotiables[id] = checked;
      log.times.nonNegotiables[id] = time;
    });
    const note = debriefDays[date];
    if (note) {
      log.sustain = note[0];
      log.improve = note[1];
      log.adjust = note[2];
      log.times.sustain = time;
      log.times.improve = time;
      log.times.adjust = time;
    }
    const hour = h % 5 === 0 ? 20 : 8;
    const [y, m, d] = date.split("-").map(Number);
    log.loggedAt = new Date(y, m - 1, d, hour, 15, 0).toISOString();
    log.times.loggedAt = log.loggedAt;
    logs.push(log);
  }
  return logs;
}

function closedReview(plans: QuadrantPlan[], notes: Record<QuadrantId, { rating: "hit" | "partial" | "missed"; notes: string }>, debrief: [string, string, string, string], time: string) {
  const review = createReview(time);
  for (const quadrant of QUADRANT_IDS) {
    review.quadrants[quadrant] = { rating: notes[quadrant].rating, notes: notes[quadrant].notes };
    review.times.quadrants[quadrant] = { rating: time, notes: time };
  }
  review.sustain = debrief[0];
  review.improve = debrief[1];
  review.adjust = debrief[2];
  review.carryForward = debrief[3];
  review.closed = true;
  review.times.sustain = time;
  review.times.improve = time;
  review.times.adjust = time;
  review.times.carryForward = time;
  review.times.closed = time;
  void plans;
  return review;
}

export function buildDemoData(today: string): UserData {
  const time = STAMP;
  const profile = createProfile({
    id: DEMO_USER_ID,
    name: "Marcus Hale",
    email: DEMO_EMAIL,
    time,
    teamId: "team-northline",
    onboarded: true,
  });

  const q2 = createQuarter({
    id: "q2-2026",
    label: "Q2 2026",
    startDate: "2026-04-06",
    endDate: "2026-07-05",
    status: "closed",
    vision: "Show up at home and stop treating my health like a rumor.",
    time,
  });
  const q3 = createQuarter({
    id: "q3-2026",
    label: "Q3 2026",
    startDate: "2026-07-06",
    endDate: "2026-10-04",
    status: "closed",
    vision: "Be easier to live with, and get the money out of the drawer.",
    carryForwardNote: "Keep the Sunday call. The second workout can wait.",
    time,
  });
  const q4 = createQuarter({
    id: "q4-2026",
    label: "Q4 2026",
    startDate: "2026-10-05",
    endDate: "2027-01-03",
    status: "active",
    vision: "Be steady at home, honest with myself, and useful to the people who depend on my work.",
    carryForwardNote: "The evening conversation stayed. The second workout can wait until sleep is boringly consistent.",
    time,
  });
  const q1 = createQuarter({
    id: "q1-2027",
    label: "Q1 2027",
    startDate: "2027-01-04",
    endDate: "2027-04-04",
    status: "draft",
    vision: "",
    time,
  });

  const q2Ids = nnIds("q2");
  const q3Ids = nnIds("q3");
  const q4Ids = nnIds("q4");
  const q2Plans = plansFrom(Q2_PLANS, time);
  const q3Plans = plansFrom(Q3_PLANS, time);
  const q4Plans = plansFrom(Q4_PLANS, time);
  const q1Plans = createPlans(time);

  const q3DebriefDate = "2026-09-20";
  const q2DebriefDate = "2026-06-14";
  const q2Logs = synthesize(q2, q2Ids, q2.endDate, [], {
    [q2DebriefDate]: [
      "The walks happened even on the short days.",
      "I still ate in front of the laptop twice.",
      "Lunch goes to the bench outside.",
    ],
  }, time);
  const q3Logs = synthesize(q3, q3Ids, q3.endDate, [], {
    [q3DebriefDate]: [
      "I made the Sunday call from the truck.",
      "I skipped the lift and called it recovery when it was avoidance.",
      "Name the skipped day in the debrief instead of renaming it.",
    ],
  }, time);

  const gapA = addDays(today, -3);
  const gapB = addDays(today, -1);
  const debriefDay = addDays(today, -2);
  const through = addDays(today, -1);
  const q4Through = through < q4.startDate ? q4.startDate : through > q4.endDate ? q4.endDate : through;
  const q4Logs =
    today <= q4.startDate
      ? []
      : synthesize(q4, q4Ids, q4Through, [gapA, gapB].filter((date) => date >= q4.startDate && date <= q4Through), {
          [debriefDay]: [
            "I kept the morning quiet even though the day started early.",
            "I answered messages during dinner.",
            "Phone stays in the other room until the dishes are done.",
          ],
        }, time);

  const q2Review = closedReview(q2Plans, {
    calibration: { rating: "hit", notes: "The night reading became ordinary. I was actually in the room on Sundays." },
    connection: { rating: "hit", notes: "Dinner at the table landed. The screens stayed in the other room most nights." },
    condition: { rating: "partial", notes: "The walk was real. I delayed the doctor until the last two weeks, then I went." },
    contribution: { rating: "partial", notes: "The no took too long. Once it was sent, the paid work got the hour." },
  }, [
    "I stopped negotiating with the walk.",
    "Hard conversations waited until the quarter was almost over.",
    "Say the no in the first month next time.",
    "Keep the Sunday call. The second workout can wait.",
  ], time);

  const q3Review = closedReview(q3Plans, {
    calibration: { rating: "partial", notes: "The morning page was steady. The quiet afternoon took until day 60." },
    connection: { rating: "partial", notes: "Two Sundays disappeared while I was on the road. The rest of the calls were real." },
    condition: { rating: "hit", notes: "Three lifting days stuck, and lunch left the desk." },
    contribution: { rating: "hit", notes: "The invoice pile was actually gone by day 60." },
  }, [
    "The money check worked because it was daily and small.",
    "Travel still erased the Sunday call.",
    "Put the call on the calendar before the trip, not after.",
    "The evening conversation stayed. Sleep before a second workout.",
  ], time);

  const q4Review = createReview(time);

  const data: UserData = {
    profile,
    quarters: [q2, q3, q4, q1],
    plans: {
      [q2.id]: q2Plans,
      [q3.id]: q3Plans,
      [q4.id]: q4Plans,
      [q1.id]: q1Plans,
    },
    nonNegotiables: {
      [q2.id]: nn(q2Ids, NN_LABELS, time),
      [q3.id]: nn(q3Ids, NN_LABELS, time),
      [q4.id]: nn(q4Ids, NN_LABELS, time),
      [q1.id]: [],
    },
    logs: [...q2Logs, ...q3Logs, ...q4Logs],
    reviews: { [q2.id]: q2Review, [q3.id]: q3Review, [q4.id]: q4Review },
    snapshots: {},
    posts: [],
    feedback: [],
    leaderRequest: null,
    teamEdits: {},
    updatedAt: time,
  };

  for (const quarter of [q2, q3]) {
    const stats = summarizeQuarter({
      quarter,
      logs: data.logs,
      nonNegotiables: data.nonNegotiables[quarter.id],
      plans: data.plans[quarter.id],
      review: data.reviews[quarter.id],
      today: quarter.endDate,
    });
    const self: StandingRow = {
      userId: profile.id,
      name: profile.name,
      teamId: profile.teamId,
      visibility: profile.visibility,
      points: stats.points,
      daysLogged: stats.daysLogged,
      fullFours: stats.fullFours,
      currentStreak: stats.currentStreak,
      badges: stats.badges,
      eveningLogs: stats.eveningLogs,
      sample: false,
    };
    const rows = visibleStandings(
      [self, ...SAMPLE_MEMBERS.map((member) => sampleRow(member, quarter.id))],
      { userId: profile.id, teamId: profile.teamId },
      "council",
    );
    data.snapshots[quarter.id] = buildSnapshot({
      quarter,
      stats,
      rows,
      viewerId: profile.id,
      teamId: profile.teamId,
      closedAt: `${quarter.endDate}T23:00:00.000Z`,
    });
  }

  // Touch the debrief day so the reminder copy is stable even if `today` slides.
  void dayCountsForStreak;
  return data;
}

export function freshQuarterData(input: { id: string; name: string; email: string; today: string; time: string }): UserData {
  const profile = createProfile({ id: input.id, name: input.name, email: input.email, time: input.time, onboarded: false });
  const current = createQuarter({ id: `q-${input.today}`, startDate: input.today, status: "active", time: input.time });
  const draftStart = addDays(current.endDate, 1);
  const draft = createQuarter({
    id: `q-${draftStart}`,
    startDate: draftStart,
    status: "draft",
    time: input.time,
  });
  return {
    profile,
    quarters: [current, draft],
    plans: { [current.id]: createPlans(input.time), [draft.id]: createPlans(input.time) },
    nonNegotiables: { [current.id]: [], [draft.id]: [] },
    logs: [],
    reviews: { [current.id]: createReview(input.time), [draft.id]: createReview(input.time) },
    snapshots: {},
    posts: [],
    feedback: [],
    leaderRequest: null,
    teamEdits: {},
    updatedAt: input.time,
  };
}
