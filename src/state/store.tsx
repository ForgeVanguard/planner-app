import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { COUNCIL_NAME, DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID, MAX_NON_NEGOTIABLES } from "../config";
import { CATALOG_POSTS, SAMPLE_MEMBERS, TEAMS } from "../data/catalog";
import { buildDemoData, freshQuarterData } from "../data/demo-seed";
import {
  loadAccounts,
  loadSession,
  loadShadow,
  saveAccounts,
  saveSession,
  saveShadow,
  type Account,
  type Session,
} from "../data/local-db";
import { pullUser, pushUser } from "../data/remote-sync";
import { supabase, supabaseEnabled } from "../data/supabase";
import { todayISO } from "../domain/dates";
import { copyPlans } from "../domain/export-data";
import {
  activeNonNegotiables,
  createLog,
  createNonNegotiable,
  createPlans,
  createQuarter,
  createReview,
  emptyUserData,
  suggestLabel,
  uid,
} from "../domain/model";
import { addDays, formatWeekdayLong } from "../domain/dates";
import { nextDraft, quarterContaining } from "../domain/quarters";
import {
  archiveQuarters,
  buildSnapshot,
  lifetimeBadgeIds,
  lifetimeStats,
  sampleRow,
  summarizeQuarter,
  visibleStandings,
  type QuarterStats,
  type StandingRow,
} from "../domain/stats";
import { applyOps, enqueueOp, flushQueue, mergeUser } from "../domain/sync";
import { formatCallTime, previousWeek, weekClose, weekRangeContaining, weekdayName } from "../domain/weeks";
import type {
  BoardPost,
  FeedbackKind,
  QuadrantId,
  QuadrantPlan,
  Quarter,
  Rating,
  SyncOp,
  Team,
  TeamEdit,
  UserData,
  Visibility,
} from "../types";
import { syncReminders } from "../lib/notifications";

interface StoreValue {
  ready: boolean;
  bootError: string | null;
  retry: () => void;
  mode: "demo" | "supabase";
  online: boolean;
  forceOffline: boolean;
  setForceOffline: (value: boolean) => void;
  pendingCount: number;
  syncLabel: string;
  session: Session | null;
  data: UserData | null;
  today: string;
  currentQuarter: Quarter | null;
  draftQuarter: Quarter | null;
  teams: Team[];
  myTeam: Team | null;
  week: WeekView | null;
  lateUnlocked: string[];
  unlockLate: (date: string) => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  enterDemo: () => Promise<void>;
  requestReset: (email: string) => Promise<string>;
  updatePassword: (current: string, next: string) => Promise<string | null>;
  updateProfile: (field: "name" | "email" | "teamId" | "visibility" | "morningReminder" | "eveningReminder" | "remindersEnabled" | "onboarded", value: string | boolean | null) => void;
  updateQuarter: (quarterId: string, field: "label" | "startDate" | "endDate" | "vision" | "carryForwardNote", value: string) => void;
  updatePlan: (quarterId: string, quadrant: QuadrantId, field: keyof QuadrantPlan, value: string | boolean) => void;
  saveNonNegotiable: (quarterId: string, id: string, label: string) => void;
  addNonNegotiable: (quarterId: string) => void;
  removeNonNegotiable: (quarterId: string, id: string) => void;
  toggleTactic: (date: string, quadrant: QuadrantId) => void;
  toggleNonNegotiable: (date: string, id: string) => void;
  updateDebrief: (date: string, field: "sustain" | "improve" | "adjust", value: string) => void;
  updateReview: (quarterId: string, field: string, value: string | boolean | Rating | null) => void;
  closeQuarter: (quarterId: string) => void;
  reopenQuarter: (quarterId: string) => void;
  copyCurrentToDraft: () => void;
  joinTeam: (teamId: string) => void;
  saveTeamSettings: (teamId: string, patch: { weekStartDay?: number; callTime?: string; timeZone?: string }) => void;
  requestLead: (teamId: string) => void;
  addPost: (body: string) => void;
  addFeedback: (kind: FeedbackKind, body: string) => void;
  completeOnboarding: () => void;
  logFor: (date: string) => UserData["logs"][number] | undefined;
  statsFor: (quarterId: string) => QuarterStats | null;
  standingsFor: (quarterId: string, scope: "council" | "team") => StandingRow[];
  boardPosts: BoardPost[];
  archive: ReturnType<typeof archiveQuarters>;
  lifetime: ReturnType<typeof lifetimeStats> | null;
  lifetimeBadges: string[];
}

export interface WeekView {
  teamName: string | null;
  weekStartDay: number;
  timeZone: string;
  callTime: string;
  callLabel: string;
  rangeLabel: string;
  range: { start: string; end: string };
  lastRange: { start: string; end: string };
  closesInLabel: string;
  closed: boolean;
  finalizeBy: string;
  councilNote: string;
}

const StoreContext = createContext<StoreValue | null>(null);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("That took too long. Nothing was left spinning.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function resolveTeams(edits: UserData["teamEdits"]): Team[] {
  return TEAMS.map((team) => {
    const edit = edits[team.id];
    if (!edit) return team;
    return {
      ...team,
      weekStartDay: edit.weekStartDay ?? team.weekStartDay,
      callTime: edit.callTime ?? team.callTime,
      timeZone: edit.timeZone ?? team.timeZone,
      leaderId: edit.leaderId === undefined ? team.leaderId : edit.leaderId,
    };
  });
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<UserData | null>(null);
  const [queue, setQueue] = useState<SyncOp[]>([]);
  const [online, setOnline] = useState(true);
  const [forceOffline, setForceOffline] = useState(false);
  const [syncLabel, setSyncLabel] = useState("Saved on this device");
  const [lateUnlocked, setLateUnlocked] = useState<string[]>([]);
  const [bootId, setBootId] = useState(0);
  const dataRef = useRef<UserData | null>(null);
  const queueRef = useRef<SyncOp[]>([]);
  const accountsRef = useRef<Account[]>([]);
  const sessionRef = useRef<Session | null>(null);
  dataRef.current = data;
  queueRef.current = queue;
  accountsRef.current = accounts;
  sessionRef.current = session;
  const effectiveOnline = online && !forceOffline;
  const mode = supabaseEnabled ? "supabase" : "demo";

  const persist = useCallback(async (nextAccounts: Account[], nextSession: Session | null) => {
    await saveAccounts(nextAccounts);
    await saveSession(nextSession);
  }, []);

  const replaceAccount = useCallback(
    (account: Account, nextSession: Session | null = sessionRef.current) => {
      const nextAccounts = accountsRef.current.some((item) => item.userId === account.userId)
        ? accountsRef.current.map((item) => (item.userId === account.userId ? account : item))
        : [...accountsRef.current, account];
      accountsRef.current = nextAccounts;
      setAccounts(nextAccounts);
      void persist(nextAccounts, nextSession).catch(() => setSyncLabel("Couldn't write to this device"));
    },
    [persist],
  );

  const flush = useCallback(async () => {
    const current = dataRef.current;
    const pending = queueRef.current;
    const active = sessionRef.current;
    if (!current || !active) return;
    if (!(online && !forceOffline)) {
      setSyncLabel(pending.length ? `Offline — ${pending.length} change${pending.length === 1 ? "" : "s"} kept on this device` : "Offline");
      return;
    }
    try {
      if (supabaseEnabled && supabase) {
        const pulled = await withTimeout(pullUser(active.userId));
        let base = current;
        if (pulled?.profile) {
          const remote: UserData = {
            ...current,
            ...pulled,
            profile: { ...current.profile, ...pulled.profile, email: current.profile.email },
            quarters: pulled.quarters ?? current.quarters,
            plans: pulled.plans ?? current.plans,
            nonNegotiables: pulled.nonNegotiables ?? current.nonNegotiables,
            logs: pulled.logs ?? [],
            reviews: pulled.reviews ?? {},
            snapshots: pulled.snapshots ?? {},
            posts: [...CATALOG_POSTS, ...(pulled.posts ?? [])],
            feedback: pulled.feedback ?? [],
            leaderRequest: pulled.leaderRequest ?? current.leaderRequest,
            teamEdits: current.teamEdits,
          };
          base = mergeUser(remote, current);
        }
        const repaired = applyOps(base, pending);
        await withTimeout(pushUser(active.userId, repaired, todayISO()));
        dataRef.current = repaired;
        queueRef.current = [];
        setData(repaired);
        setQueue([]);
        replaceAccount({ email: active.email, password: accountsRef.current.find((item) => item.userId === active.userId)?.password ?? "", userId: active.userId, data: repaired, queue: [] });
        setSyncLabel("Synced");
        return;
      }
      const shadow = (await loadShadow(active.userId)) ?? clone(current);
      const flushed = flushQueue(shadow, pending);
      const merged = mergeUser(flushed.remote, current);
      await saveShadow(active.userId, merged);
      dataRef.current = merged;
      queueRef.current = flushed.remaining;
      setData(merged);
      setQueue(flushed.remaining);
      const account = accountsRef.current.find((item) => item.userId === active.userId);
      if (account) replaceAccount({ ...account, data: merged, queue: flushed.remaining });
      setSyncLabel(flushed.remaining.length ? `${flushed.remaining.length} still waiting` : "Saved on this device");
    } catch (error) {
      setSyncLabel(error instanceof Error ? error.message : "Sync paused — changes are still on this device");
    }
  }, [forceOffline, online, replaceAccount]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const storedAccounts = await loadAccounts();
        const storedSession = await loadSession();
        if (cancelled) return;
        if (supabaseEnabled && supabase) {
          const { data: auth } = await withTimeout(supabase.auth.getSession(), 8000);
          if (auth.session) {
            const email = auth.session.user.email ?? "";
            const userId = auth.session.user.id;
            let account = storedAccounts.find((item) => item.userId === userId);
            if (!account) {
              const profileName = String(auth.session.user.user_metadata?.display_name ?? email.split("@")[0] ?? "Member");
              account = {
                email,
                password: "",
                userId,
                data: freshQuarterData({ id: userId, name: profileName, email, today: todayISO(), time: new Date().toISOString() }),
                queue: [],
              };
            }
            const repaired = applyOps(account.data, account.queue);
            account = { ...account, data: repaired };
            setAccounts(storedAccounts.some((item) => item.userId === userId) ? storedAccounts.map((item) => (item.userId === userId ? account! : item)) : [...storedAccounts, account]);
            setSession({ userId, email });
            setData(repaired);
            setQueue(account.queue);
            setReady(true);
            return;
          }
          setAccounts(storedAccounts);
          setReady(true);
          return;
        }
        let nextAccounts = storedAccounts;
        let nextSession = storedSession;
        if (!nextSession) {
          let demo = nextAccounts.find((item) => item.userId === DEMO_USER_ID);
          if (!demo) {
            demo = { email: DEMO_EMAIL, password: DEMO_PASSWORD, userId: DEMO_USER_ID, data: buildDemoData(todayISO()), queue: [] };
            nextAccounts = [...nextAccounts, demo];
          }
          nextSession = { userId: demo.userId, email: demo.email };
          await persist(nextAccounts, nextSession);
        }
        const account = nextAccounts.find((item) => item.userId === nextSession?.userId) ?? nextAccounts[0];
        if (!account) throw new Error("No local record");
        const repaired = applyOps(account.data, account.queue);
        setAccounts(nextAccounts.map((item) => (item.userId === account.userId ? { ...account, data: repaired } : item)));
        setSession({ userId: account.userId, email: account.email });
        setData(repaired);
        setQueue(account.queue);
        setReady(true);
        setBootError(null);
      } catch (error) {
        if (cancelled) return;
        const fallback = buildDemoData(todayISO());
        const account: Account = { email: DEMO_EMAIL, password: DEMO_PASSWORD, userId: DEMO_USER_ID, data: fallback, queue: [] };
        setAccounts([account]);
        setSession({ userId: account.userId, email: account.email });
        setData(fallback);
        setQueue([]);
        setReady(true);
        setBootError(error instanceof Error ? error.message : "Opened the demo workspace in memory.");
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [bootId, persist]);

  useEffect(() => {
    let remove: (() => void) | undefined;
    const listen = async () => {
      try {
        const Network = await import("expo-network");
        const state = await Network.getNetworkStateAsync();
        setOnline(state.isConnected !== false && state.isInternetReachable !== false);
        const sub = Network.addNetworkStateListener((event) => {
          setOnline(event.isConnected !== false && event.isInternetReachable !== false);
        });
        remove = () => sub.remove();
      } catch {
        setOnline(true);
      }
    };
    void listen();
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const on = () => setOnline(window.navigator.onLine);
      window.addEventListener("online", on);
      window.addEventListener("offline", on);
      on();
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", on);
        remove?.();
      };
    }
    return () => remove?.();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void flush();
  }, [ready, effectiveOnline, flush]);

  useEffect(() => {
    if (data?.profile) void syncReminders(data.profile);
  }, [data?.profile.remindersEnabled, data?.profile.morningReminder, data?.profile.eveningReminder, data?.profile.id]);

  const commit = useCallback(
    (recipe: (draft: UserData, time: string) => SyncOp[]) => {
      const time = new Date().toISOString();
      const current = dataRef.current;
      const active = sessionRef.current;
      if (!current || !active) return;
      const draft = clone(current);
      const ops = recipe(draft, time);
      draft.updatedAt = time;
      let nextQueue = queueRef.current;
      for (const op of ops) nextQueue = enqueueOp(nextQueue, op);
      dataRef.current = draft;
      queueRef.current = nextQueue;
      setData(draft);
      setQueue(nextQueue);
      const account = accountsRef.current.find((item) => item.userId === active.userId);
      if (account) replaceAccount({ ...account, data: draft, queue: nextQueue });
      setSyncLabel(effectiveOnline ? "Pending sync" : `Offline — ${nextQueue.length} change${nextQueue.length === 1 ? "" : "s"} kept on this device`);
      if (effectiveOnline) void flush();
    },
    [effectiveOnline, flush, replaceAccount],
  );

  const today = todayISO();
  const currentQuarter = data ? quarterContaining(data.quarters, today) : null;
  const draftQuarter = data ? nextDraft(data.quarters, currentQuarter) : null;
  const teams = useMemo(() => resolveTeams(data?.teamEdits ?? {}), [data?.teamEdits]);
  const myTeam = teams.find((team) => team.id === data?.profile.teamId) ?? null;

  const week = useMemo<WeekView | null>(() => {
    if (!data) return null;
    const weekStartDay = myTeam?.weekStartDay ?? 1;
    const timeZone = myTeam?.timeZone ?? "UTC";
    const callTime = myTeam?.callTime ?? "19:00";
    const range = weekRangeContaining(today, weekStartDay);
    const close = weekClose(new Date(), range, timeZone);
    const teamName = myTeam?.name ?? null;
    return {
      teamName,
      weekStartDay,
      timeZone,
      callTime,
      callLabel: `${weekdayName(weekStartDay)} at ${formatCallTime(callTime)}${myTeam ? ` (${myTeam.timeZone})` : ""}`,
      rangeLabel: `${formatWeekdayLong(range.start)} – ${formatWeekdayLong(range.end)}`,
      range,
      lastRange: previousWeek(range),
      closesInLabel: close.closesInLabel,
      closed: close.closed,
      finalizeBy: formatWeekdayLong(close.finalizeByDate),
      councilNote: `${COUNCIL_NAME} points, streaks, and standings stay on the shared quarter calendar so every team can be compared. This week follows ${teamName ?? "a Monday personal week"}.`,
    };
  }, [data, myTeam, today]);

  const value = useMemo<StoreValue>(() => {
    const statsFor = (quarterId: string) => {
      if (!data) return null;
      const quarter = data.quarters.find((item) => item.id === quarterId);
      if (!quarter) return null;
      return summarizeQuarter({
        quarter,
        logs: data.logs,
        nonNegotiables: data.nonNegotiables[quarterId] ?? [],
        plans: data.plans[quarterId] ?? [],
        review: data.reviews[quarterId],
        today,
      });
    };
    const standingsFor = (quarterId: string, scope: "council" | "team"): StandingRow[] => {
      if (!data) return [];
      const stats = statsFor(quarterId);
      const snapshot = data.snapshots[quarterId];
      const quarter = data.quarters.find((item) => item.id === quarterId);
      const useSnapshot = Boolean(snapshot && quarter?.status === "closed");
      const self: StandingRow = {
        userId: data.profile.id,
        name: data.profile.name,
        teamId: data.profile.teamId,
        visibility: data.profile.visibility,
        points: useSnapshot ? snapshot!.points : stats?.points ?? 0,
        daysLogged: useSnapshot ? snapshot!.daysLogged : stats?.daysLogged ?? 0,
        fullFours: useSnapshot ? snapshot!.fullFours : stats?.fullFours ?? 0,
        currentStreak: useSnapshot ? snapshot!.streakAtClose : stats?.currentStreak ?? 0,
        badges: useSnapshot ? snapshot!.badges : stats?.badges ?? [],
        eveningLogs: stats?.eveningLogs ?? 0,
        sample: false,
      };
      const rows = [self, ...SAMPLE_MEMBERS.map((member) => sampleRow(member, quarterId))];
      return visibleStandings(rows, { userId: data.profile.id, teamId: data.profile.teamId }, scope);
    };
    const life = data
      ? lifetimeStats({ quarters: data.quarters, logs: data.logs, nonNegotiables: data.nonNegotiables, today })
      : null;
    return {
      ready,
      bootError,
      retry: () => {
        setReady(false);
        setBootId((value) => value + 1);
      },
      mode,
      online: effectiveOnline,
      forceOffline,
      setForceOffline,
      pendingCount: queue.length,
      syncLabel,
      session,
      data,
      today,
      currentQuarter,
      draftQuarter,
      teams,
      myTeam,
      week,
      lateUnlocked,
      unlockLate: (date: string) => setLateUnlocked((current) => (current.includes(date) ? current : [...current, date])),
      signIn: async (email, password) => {
        try {
          if (supabaseEnabled && supabase) {
            const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }));
            if (error) return error.message;
            setBootId((value) => value + 1);
            setReady(false);
            return null;
          }
          const account = accountsRef.current.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
          if (!account || account.password !== password) return "That email and password don't match.";
          const next = { userId: account.userId, email: account.email };
          sessionRef.current = next;
          setSession(next);
          setData(account.data);
          setQueue(account.queue);
          await saveSession(next);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : "Sign-in didn't finish.";
        }
      },
      signUp: async (name, email, password) => {
        try {
          if (password.length < 8) return "Use at least 8 characters.";
          if (supabaseEnabled && supabase) {
            const { data: created, error } = await withTimeout(
              supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } }),
            );
            if (error) return error.message;
            if (!created.session) return "Check your email to confirm the account, then sign in.";
            setReady(false);
            setBootId((value) => value + 1);
            return null;
          }
          if (accountsRef.current.some((item) => item.email.toLowerCase() === email.trim().toLowerCase())) {
            return "An account with that email already exists on this device.";
          }
          const time = new Date().toISOString();
          const userId = uid("user");
          const account: Account = {
            email: email.trim(),
            password,
            userId,
            data: freshQuarterData({ id: userId, name: name.trim(), email: email.trim(), today, time }),
            queue: [],
          };
          const nextAccounts = [...accountsRef.current, account];
          const next = { userId, email: account.email };
          accountsRef.current = nextAccounts;
          sessionRef.current = next;
          setAccounts(nextAccounts);
          setSession(next);
          setData(account.data);
          setQueue([]);
          await persist(nextAccounts, next);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : "Sign-up didn't finish.";
        }
      },
      signOut: async () => {
        if (supabaseEnabled && supabase) await supabase.auth.signOut();
        sessionRef.current = null;
        setSession(null);
        setData(null);
        setQueue([]);
        await saveSession(null);
      },
      enterDemo: async () => {
        let demo = accountsRef.current.find((item) => item.userId === DEMO_USER_ID);
        if (!demo) {
          demo = { email: DEMO_EMAIL, password: DEMO_PASSWORD, userId: DEMO_USER_ID, data: buildDemoData(today), queue: [] };
        }
        const nextAccounts = accountsRef.current.some((item) => item.userId === DEMO_USER_ID)
          ? accountsRef.current
          : [...accountsRef.current, demo];
        const next = { userId: demo.userId, email: demo.email };
        accountsRef.current = nextAccounts;
        sessionRef.current = next;
        setAccounts(nextAccounts);
        setSession(next);
        setData(demo.data);
        setQueue(demo.queue);
        await persist(nextAccounts, next);
      },
      requestReset: async (email) => {
        if (supabaseEnabled && supabase) {
          const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email.trim()));
          if (error) return error.message;
          return "If that inbox is registered, a reset link is on the way.";
        }
        return `Demo mode doesn't send email. The sample workspace is ${DEMO_EMAIL} / ${DEMO_PASSWORD}.`;
      },
      updatePassword: async (current, next) => {
        if (supabaseEnabled && supabase) {
          const { error } = await withTimeout(supabase.auth.updateUser({ password: next }));
          return error ? error.message : null;
        }
        const active = sessionRef.current;
        const account = accountsRef.current.find((item) => item.userId === active?.userId);
        if (!account || account.password !== current) return "The current password doesn't match.";
        if (next.length < 8 && account.userId !== DEMO_USER_ID) return "Use at least 8 characters.";
        replaceAccount({ ...account, password: next });
        return null;
      },
      updateProfile: (field, value) => {
        commit((draft, time) => {
          draft.profile[field] = value as never;
          draft.profile.times[field] = time;
          return [{ id: uid("op"), kind: "profile-field", entityId: draft.profile.id, field, value, updatedAt: time }];
        });
      },
      updateQuarter: (quarterId, field, value) => {
        commit((draft, time) => {
          const quarter = draft.quarters.find((item) => item.id === quarterId);
          if (!quarter || quarter.status === "closed") return [];
          quarter[field] = value;
          quarter.times[field] = time;
          return [{ id: uid("op"), kind: "quarter-field", entityId: quarterId, field, value, updatedAt: time }];
        });
      },
      updatePlan: (quarterId, quadrant, field, value) => {
        if (field === "quadrant" || field === "times") return;
        commit((draft, time) => {
          const quarter = draft.quarters.find((item) => item.id === quarterId);
          if (!quarter || quarter.status === "closed") return [];
          const plans = draft.plans[quarterId] ?? createPlans(time);
          draft.plans[quarterId] = plans;
          const plan = plans.find((item) => item.quadrant === quadrant);
          if (!plan || !(field in plan.times)) return [];
          plan[field] = value as never;
          plan.times[field as keyof QuadrantPlan["times"]] = time;
          return [{ id: uid("op"), kind: "plan-field", entityId: `${quarterId}:${quadrant}`, field, value, updatedAt: time }];
        });
      },
      saveNonNegotiable: (quarterId, id, label) => {
        commit((draft, time) => {
          const quarter = draft.quarters.find((item) => item.id === quarterId);
          if (!quarter || quarter.status === "closed") return [];
          const items = draft.nonNegotiables[quarterId] ?? [];
          const item = items.find((entry) => entry.id === id);
          if (!item) return [];
          item.label = label;
          item.updatedAt = time;
          return [{ id: uid("op"), kind: "nn", entityId: quarterId, field: id, value: { label, deleted: item.deleted }, updatedAt: time }];
        });
      },
      addNonNegotiable: (quarterId) => {
        commit((draft, time) => {
          const quarter = draft.quarters.find((item) => item.id === quarterId);
          if (!quarter || quarter.status === "closed") return [];
          const items = draft.nonNegotiables[quarterId] ?? [];
          if (activeNonNegotiables(items).length >= MAX_NON_NEGOTIABLES) return [];
          const id = uid("nn");
          const item = createNonNegotiable(id, "", time);
          draft.nonNegotiables[quarterId] = [...items, item];
          return [{ id: uid("op"), kind: "nn", entityId: quarterId, field: id, value: { label: "", deleted: false }, updatedAt: time }];
        });
      },
      removeNonNegotiable: (quarterId, id) => {
        commit((draft, time) => {
          const item = (draft.nonNegotiables[quarterId] ?? []).find((entry) => entry.id === id);
          if (!item) return [];
          item.deleted = true;
          item.updatedAt = time;
          return [{ id: uid("op"), kind: "nn", entityId: quarterId, field: id, value: { label: item.label, deleted: true }, updatedAt: time }];
        });
      },
      toggleTactic: (date, quadrant) => {
        commit((draft, time) => {
          const quarter = quarterContaining(draft.quarters, date);
          if (!quarter || quarter.status === "closed") return [];
          let log = draft.logs.find((item) => item.date === date);
          if (!log) {
            log = createLog(date, quarter.id, time);
            draft.logs.push(log);
            draft.logs.sort((a, b) => (a.date < b.date ? -1 : 1));
          }
          const value = !log.tactics[quadrant];
          log.tactics[quadrant] = value;
          log.times.tactics[quadrant] = time;
          if (!log.loggedAt) {
            log.loggedAt = time;
            log.times.loggedAt = time;
          }
          return [{ id: uid("op"), kind: "log-field", entityId: date, field: `tactics.${quadrant}`, value, updatedAt: time, quarterId: quarter.id }];
        });
      },
      toggleNonNegotiable: (date, id) => {
        commit((draft, time) => {
          const quarter = quarterContaining(draft.quarters, date);
          if (!quarter || quarter.status === "closed") return [];
          let log = draft.logs.find((item) => item.date === date);
          if (!log) {
            log = createLog(date, quarter.id, time);
            draft.logs.push(log);
          }
          const value = !log.nonNegotiables[id];
          log.nonNegotiables[id] = value;
          log.times.nonNegotiables[id] = time;
          if (!log.loggedAt) {
            log.loggedAt = time;
            log.times.loggedAt = time;
          }
          return [{ id: uid("op"), kind: "log-field", entityId: date, field: `nn.${id}`, value, updatedAt: time, quarterId: quarter.id }];
        });
      },
      updateDebrief: (date, field, value) => {
        commit((draft, time) => {
          const quarter = quarterContaining(draft.quarters, date);
          if (!quarter || quarter.status === "closed") return [];
          let log = draft.logs.find((item) => item.date === date);
          if (!log) {
            log = createLog(date, quarter.id, time);
            draft.logs.push(log);
          }
          log[field] = value;
          log.times[field] = time;
          if (!log.loggedAt) {
            log.loggedAt = time;
            log.times.loggedAt = time;
          }
          return [{ id: uid("op"), kind: "log-field", entityId: date, field, value, updatedAt: time, quarterId: quarter.id }];
        });
      },
      updateReview: (quarterId, field, value) => {
        commit((draft, time) => {
          const review = draft.reviews[quarterId] ?? createReview(time);
          draft.reviews[quarterId] = review;
          const [group, quadrant, leaf] = field.split(".");
          if (group === "quadrant" && leaf) {
            const id = quadrant as QuadrantId;
            review.quadrants[id][leaf as "rating" | "notes"] = value as never;
            review.times.quadrants[id][leaf as "rating" | "notes"] = time;
          } else if (group === "sustain" || group === "improve" || group === "adjust" || group === "carryForward") {
            review[group] = String(value ?? "");
            review.times[group] = time;
          }
          return [{ id: uid("op"), kind: "review-field", entityId: quarterId, field, value, updatedAt: time }];
        });
      },
      closeQuarter: (quarterId) => {
        commit((draft, time) => {
          const quarter = draft.quarters.find((item) => item.id === quarterId);
          if (!quarter) return [];
          quarter.status = "closed";
          quarter.times.status = time;
          const review = draft.reviews[quarterId] ?? createReview(time);
          review.closed = true;
          review.times.closed = time;
          if (!review.carryForward.trim()) {
            review.carryForward = review.adjust;
            review.times.carryForward = time;
          }
          draft.reviews[quarterId] = review;
          const stats = summarizeQuarter({
            quarter,
            logs: draft.logs,
            nonNegotiables: draft.nonNegotiables[quarterId] ?? [],
            plans: draft.plans[quarterId] ?? [],
            review,
            today,
          });
          const selfPoints = stats.points;
          const rows = visibleStandings(
            [
              {
                userId: draft.profile.id,
                name: draft.profile.name,
                teamId: draft.profile.teamId,
                visibility: draft.profile.visibility,
                points: selfPoints,
                daysLogged: stats.daysLogged,
                fullFours: stats.fullFours,
                currentStreak: stats.currentStreak,
                badges: stats.badges,
                eveningLogs: stats.eveningLogs,
                sample: false,
              },
              ...SAMPLE_MEMBERS.map((member) => sampleRow(member, quarterId)),
            ],
            { userId: draft.profile.id, teamId: draft.profile.teamId },
            "council",
          );
          const snapshot = buildSnapshot({
            quarter,
            stats,
            rows,
            viewerId: draft.profile.id,
            teamId: draft.profile.teamId,
            closedAt: time,
          });
          draft.snapshots[quarterId] = snapshot;
          const draftQuarter = nextDraft(draft.quarters, quarter);
          const ops: SyncOp[] = [
            { id: uid("op"), kind: "quarter-field", entityId: quarterId, field: "status", value: "closed", updatedAt: time },
            { id: uid("op"), kind: "review-field", entityId: quarterId, field: "closed", value: true, updatedAt: time },
            { id: uid("op"), kind: "snapshot", entityId: quarterId, field: "snapshot", value: snapshot, updatedAt: time },
          ];
          if (draftQuarter && review.carryForward.trim()) {
            draftQuarter.carryForwardNote = review.carryForward;
            draftQuarter.times.carryForwardNote = time;
            ops.push({
              id: uid("op"),
              kind: "quarter-field",
              entityId: draftQuarter.id,
              field: "carryForwardNote",
              value: review.carryForward,
              updatedAt: time,
            });
          }
          return ops;
        });
      },
      reopenQuarter: (quarterId) => {
        commit((draft, time) => {
          const quarter = draft.quarters.find((item) => item.id === quarterId);
          if (!quarter) return [];
          quarter.status = "active";
          quarter.times.status = time;
          const review = draft.reviews[quarterId] ?? createReview(time);
          review.closed = false;
          review.times.closed = time;
          draft.reviews[quarterId] = review;
          return [
            { id: uid("op"), kind: "quarter-field", entityId: quarterId, field: "status", value: "active", updatedAt: time },
            { id: uid("op"), kind: "review-field", entityId: quarterId, field: "closed", value: false, updatedAt: time },
          ];
        });
      },
      copyCurrentToDraft: () => {
        commit((draft, time) => {
          const current = quarterContaining(draft.quarters, today);
          if (!current) return [];
          let draftQuarter = nextDraft(draft.quarters, current);
          const ops: SyncOp[] = [];
          if (!draftQuarter) {
            const start = addDays(current.endDate, 1);
            draftQuarter = createQuarter({ id: uid("q"), startDate: start, status: "draft", time, label: suggestLabel(start) });
            draft.quarters.push(draftQuarter);
          }
          draft.plans[draftQuarter.id] = copyPlans(draft.plans[current.id] ?? createPlans(time), time);
          draft.nonNegotiables[draftQuarter.id] = activeNonNegotiables(draft.nonNegotiables[current.id]).map((item) =>
            createNonNegotiable(uid("nn"), item.label, time),
          );
          draftQuarter.vision = current.vision;
          draftQuarter.times.vision = time;
          for (const plan of draft.plans[draftQuarter.id]) {
            for (const field of ["objective", "tactic", "secondaryTactic", "checkpoint30", "checkpoint60"] as const) {
              ops.push({
                id: uid("op"),
                kind: "plan-field",
                entityId: `${draftQuarter.id}:${plan.quadrant}`,
                field,
                value: plan[field],
                updatedAt: time,
              });
            }
          }
          return ops;
        });
      },
      joinTeam: (teamId) => {
        commit((draft, time) => {
          draft.profile.teamId = teamId;
          draft.profile.times.teamId = time;
          return [{ id: uid("op"), kind: "profile-field", entityId: draft.profile.id, field: "teamId", value: teamId, updatedAt: time }];
        });
      },
      saveTeamSettings: (teamId, patch) => {
        commit((draft, time) => {
          const team = resolveTeams(draft.teamEdits).find((item) => item.id === teamId);
          if (!team || team.leaderId !== draft.profile.id) return [];
          const edit: TeamEdit = {
            ...(draft.teamEdits[teamId] ?? { times: {} }),
            ...patch,
            times: { ...(draft.teamEdits[teamId]?.times ?? {}) },
          };
          if (patch.weekStartDay !== undefined) edit.times.weekStartDay = time;
          if (patch.callTime !== undefined) edit.times.callTime = time;
          if (patch.timeZone !== undefined) edit.times.timeZone = time;
          draft.teamEdits[teamId] = edit;
          return [{ id: uid("op"), kind: "team", entityId: teamId, field: "settings", value: edit, updatedAt: time }];
        });
      },
      requestLead: (teamId) => {
        commit((draft, time) => {
          draft.leaderRequest = { teamId, status: "pending", createdAt: time };
          return [{ id: uid("op"), kind: "leader", entityId: teamId, field: "request", value: draft.leaderRequest, updatedAt: time }];
        });
      },
      addPost: (body) => {
        commit((draft, time) => {
          if (!draft.profile.teamId || !body.trim()) return [];
          const post: BoardPost = {
            id: uid("post"),
            teamId: draft.profile.teamId,
            authorId: draft.profile.id,
            authorName: draft.profile.name,
            body: body.trim(),
            createdAt: time,
          };
          draft.posts = [post, ...draft.posts];
          return [{ id: uid("op"), kind: "post", entityId: post.id, field: "body", value: post, updatedAt: time }];
        });
      },
      addFeedback: (kind, body) => {
        commit((draft, time) => {
          if (!body.trim()) return [];
          const item = { id: uid("fb"), kind, body: body.trim(), createdAt: time };
          draft.feedback = [...draft.feedback, item];
          return [{ id: uid("op"), kind: "feedback", entityId: item.id, field: "body", value: item, updatedAt: time }];
        });
      },
      completeOnboarding: () => {
        commit((draft, time) => {
          draft.profile.onboarded = true;
          draft.profile.times.onboarded = time;
          return [{ id: uid("op"), kind: "profile-field", entityId: draft.profile.id, field: "onboarded", value: true, updatedAt: time }];
        });
      },
      logFor: (date) => data?.logs.find((log) => log.date === date),
      statsFor,
      standingsFor,
      boardPosts: [...CATALOG_POSTS, ...(data?.posts ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      archive: data
        ? archiveQuarters({
            quarters: data.quarters,
            logs: data.logs,
            nonNegotiables: data.nonNegotiables,
            plans: data.plans,
            reviews: data.reviews,
            snapshots: data.snapshots,
            today,
          })
        : [],
      lifetime: life,
      lifetimeBadges: life ? lifetimeBadgeIds(life) : [],
    };
  }, [
    ready,
    bootError,
    mode,
    effectiveOnline,
    forceOffline,
    queue.length,
    syncLabel,
    session,
    data,
    today,
    currentQuarter,
    draftQuarter,
    teams,
    myTeam,
    week,
    lateUnlocked,
    commit,
    persist,
    replaceAccount,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useApp must be used inside StoreProvider");
  return value;
}
