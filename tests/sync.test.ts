import { describe, expect, it } from "vitest";
import { createLog, createProfile, emptyUserData } from "../src/domain/model";
import { applyOp, applyOps, enqueueOp, flushQueue, mergeDayLog, mergeLogSets, mergeUser, reconcileLogs } from "../src/domain/sync";
import type { SyncOp, UserData } from "../src/types";

function baseData(): UserData {
  const profile = createProfile({ id: "u1", name: "Marcus", email: "m@example.com", time: "2026-10-01T00:00:00.000Z" });
  return emptyUserData(profile, "2026-10-01T00:00:00.000Z");
}

describe("sync queue and field merge", () => {
  it("keeps one queued write per field and the later value", () => {
    const first: SyncOp = {
      id: "1",
      kind: "log-field",
      entityId: "2026-10-19",
      field: "tactics.calibration",
      value: true,
      updatedAt: "2026-10-19T12:00:00.000Z",
      quarterId: "q4",
    };
    const second = { ...first, id: "2", value: false, updatedAt: "2026-10-19T18:00:00.000Z" };
    const queue = enqueueOp(enqueueOp([], first), second);
    expect(queue).toHaveLength(1);
    expect(queue[0].value).toBe(false);
  });

  it("merges a day field by timestamp and never drops a day that only one side has", () => {
    const local = createLog("2026-10-19", "q4", "2026-10-19T10:00:00.000Z");
    local.tactics.calibration = true;
    local.times.tactics.calibration = "2026-10-19T18:00:00.000Z";
    local.adjust = "";
    local.times.adjust = "2026-10-19T10:00:00.000Z";

    const remote = createLog("2026-10-19", "q4", "2026-10-19T10:00:00.000Z");
    remote.tactics.calibration = false;
    remote.times.tactics.calibration = "2026-10-19T11:00:00.000Z";
    remote.adjust = "Phone in the other room.";
    remote.times.adjust = "2026-10-19T19:00:00.000Z";

    const onlyLocal = createLog("2026-10-16", "q4", "2026-10-16T12:00:00.000Z");
    onlyLocal.tactics.condition = true;
    onlyLocal.times.tactics.condition = "2026-10-16T12:00:00.000Z";
    const onlyRemote = createLog("2026-10-15", "q4", "2026-10-15T12:00:00.000Z");

    const mergedDay = mergeDayLog(remote, local);
    expect(mergedDay.tactics.calibration).toBe(true);
    expect(mergedDay.adjust).toBe("Phone in the other room.");

    const { merged, pushed } = reconcileLogs([local, onlyLocal], [remote, onlyRemote]);
    expect(merged.map((log) => log.date)).toEqual(["2026-10-15", "2026-10-16", "2026-10-19"]);
    expect(pushed.map((log) => log.date)).toEqual(expect.arrayContaining(["2026-10-16", "2026-10-19"]));
    expect(pushed.find((log) => log.date === "2026-10-15")).toBeUndefined();
    expect(mergeLogSets([onlyLocal], [onlyRemote])).toHaveLength(2);
  });

  it("replays the durable queue onto older local data without losing the day", () => {
    const data = baseData();
    const op: SyncOp = {
      id: "a",
      kind: "log-field",
      entityId: "2026-10-18",
      field: "tactics.connection",
      value: true,
      updatedAt: "2026-10-18T22:00:00.000Z",
      quarterId: "q4-2026",
    };
    const repaired = applyOps(data, [op]);
    expect(repaired.logs).toHaveLength(1);
    expect(repaired.logs[0].tactics.connection).toBe(true);
    expect(repaired.logs[0].quarterId).toBe("q4-2026");
    const stamped = applyOp(repaired, { ...op, field: "quarterId", value: "other", updatedAt: "2026-10-18T23:00:00.000Z" });
    expect(stamped.logs[0].quarterId).toBe("other");
    const ignored = applyOp(stamped, { ...op, value: false, updatedAt: "2026-10-18T21:00:00.000Z" });
    expect(ignored.logs[0].tactics.connection).toBe(true);
  });

  it("stops a flush on failure and keeps the failed op plus everything after it", () => {
    const remote = baseData();
    const ops: SyncOp[] = [1, 2, 3].map((n) => ({
      id: String(n),
      kind: "log-field" as const,
      entityId: `2026-10-1${n}`,
      field: "sustain",
      value: `note ${n}`,
      updatedAt: `2026-10-1${n}T12:00:00.000Z`,
      quarterId: "q4",
    }));
    const result = flushQueue(remote, ops, (op) => op.id === "2");
    expect(result.applied).toBe(1);
    expect(result.remaining.map((op) => op.id)).toEqual(["2", "3"]);
    expect(result.remote.logs.map((log) => log.date)).toEqual(["2026-10-11"]);
    expect(result.remote.logs[0].sustain).toBe("note 1");
  });

  it("unions quarters and logs when two copies merge", () => {
    const left = baseData();
    const right = baseData();
    right.quarters = [
      {
        id: "q-extra",
        label: "Extra",
        startDate: "2026-01-01",
        endDate: "2026-04-01",
        status: "closed",
        vision: "Kept",
        carryForwardNote: "",
        times: {
          label: "2026-04-02T00:00:00.000Z",
          startDate: "2026-04-02T00:00:00.000Z",
          endDate: "2026-04-02T00:00:00.000Z",
          status: "2026-04-02T00:00:00.000Z",
          vision: "2026-04-02T00:00:00.000Z",
          carryForwardNote: "2026-04-02T00:00:00.000Z",
        },
      },
    ];
    right.logs = [createLog("2026-03-01", "q-extra", "2026-03-01T00:00:00.000Z")];
    const merged = mergeUser(left, right);
    expect(merged.quarters.map((quarter) => quarter.id)).toContain("q-extra");
    expect(merged.logs.map((log) => log.date)).toContain("2026-03-01");
    expect(merged.quarters[0].vision).toBe("Kept");
  });
});
