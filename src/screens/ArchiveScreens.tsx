import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { TrendChart } from "../components/charts";
import { Banner, Button, Card, Page, Segmented, T } from "../components/ui";
import { COUNCIL_NAME } from "../config";
import { formatLong } from "../domain/dates";
import { debriefsFor, compareArchives } from "../domain/stats";
import { activeNonNegotiables } from "../domain/model";
import { LIFETIME_BADGES, allBadgeDefs } from "../domain/stats";
import { isQuarterEditable } from "../domain/quarters";
import { useApp } from "../state/store";
import { colors, fonts, quadrants } from "../theme";
import { QUADRANT_IDS, type QuadrantId } from "../types";

export function ArchiveHome() {
  const app = useApp();
  const router = useRouter();
  const rows = [...app.archive].sort((a, b) => (a.quarter.startDate < b.quarter.startDate ? -1 : 1));
  const labels = rows.map((row) => row.quarter.label);
  return (
    <Page>
      <T variant="title">Quarter archive</T>
      <T color={colors.textSecondary}>
        Every quarter stays. Open one for the vision, the plan, the final numbers, the review, the debriefs, and the badges. Past quarters are read-only unless you reopen them.
      </T>
      <View style={styles.actions}>
        <Button label="Achievements" variant="secondary" onPress={() => router.push("/archive/achievements")} />
        <Button label="Compare two quarters" variant="secondary" onPress={() => router.push("/archive/compare")} />
      </View>
      {rows.length >= 2 ? (
        <Card>
          <T variant="heading">Quarter over quarter</T>
          <TrendChart
            labels={labels}
            series={[
              { name: "Points", color: colors.brand, values: rows.map((row) => row.snapshot?.points ?? row.stats.points) },
              { name: "Best streak", color: quadrants.condition.text, values: rows.map((row) => row.snapshot?.bestStreak ?? row.stats.bestStreak) },
            ]}
          />
          <TrendChart
            labels={labels}
            series={QUADRANT_IDS.map((quadrant) => ({
              name: quadrants[quadrant].label,
              color: quadrants[quadrant].color,
              values: rows.map((row) => row.snapshot?.execution[quadrant] ?? row.stats.execution[quadrant]),
            }))}
          />
          <T variant="small" color={colors.textSecondary}>Brass is points. Blue is best streak. The second chart is execution percent by quadrant.</T>
        </Card>
      ) : null}
      {app.archive.map((row) => {
        const points = row.snapshot?.points ?? row.stats.points;
        const rank = row.snapshot ? `${COUNCIL_NAME} rank ${row.snapshot.councilRank} of ${row.snapshot.councilSize}` : "In progress";
        return (
          <Pressable key={row.quarter.id} accessibilityRole="button" accessibilityLabel={`Open ${row.quarter.label}`} onPress={() => router.push(`/archive/${row.quarter.id}`)}>
            <Card>
              <T variant="heading">{row.quarter.label}</T>
              <T color={colors.textSecondary}>{formatLong(row.quarter.startDate)} – {formatLong(row.quarter.endDate)} · {row.quarter.status}</T>
              <Text style={styles.wrap}>{row.quarter.vision.trim() || "No vision written."}</Text>
              <T>{points} points · {row.stats.fullFours} full-4 days · best streak {row.snapshot?.bestStreak ?? row.stats.bestStreak}</T>
              <T color={colors.textSecondary}>{rank}</T>
            </Card>
          </Pressable>
        );
      })}
    </Page>
  );
}

export function ArchiveDetail({ quarterId }: { quarterId: string }) {
  const app = useApp();
  const router = useRouter();
  const row = app.archive.find((item) => item.quarter.id === quarterId);
  if (!row || !app.data) {
    return (
      <Page>
        <T variant="title">Quarter not found</T>
        <Button label="Back to the archive" onPress={() => router.push("/archive")} />
      </Page>
    );
  }
  const { quarter, stats, snapshot, review } = row;
  const plans = app.data.plans[quarter.id] ?? [];
  const items = activeNonNegotiables(app.data.nonNegotiables[quarter.id]);
  const debriefs = debriefsFor(app.data.logs, quarter.id);
  const editable = isQuarterEditable(quarter);
  const execution = snapshot?.execution ?? stats.execution;
  return (
    <Page>
      <Button label="All quarters" variant="ghost" onPress={() => router.push("/archive")} />
      <T variant="title">{quarter.label}</T>
      <T color={colors.textSecondary}>{formatLong(quarter.startDate)} – {formatLong(quarter.endDate)}</T>
      {editable ? (
        <Banner title="Reopened" body="This quarter can be edited on the Plan screen. The archive view itself stays a record." tone="ok" />
      ) : (
        <Banner title="Read-only" body="Closed quarters stay as they were. Reopen from Review if you need to change the plan." />
      )}
      <Card>
        <T variant="heading">Vision</T>
        <Text style={styles.wrap}>{quarter.vision.trim() || "No vision written."}</Text>
        {quarter.carryForwardNote.trim() ? <Text style={styles.wrap}>Carried in: {quarter.carryForwardNote}</Text> : null}
      </Card>
      <View style={styles.tiles}>
        <Stat label="Points" value={String(snapshot?.points ?? stats.points)} />
        <Stat label="Full-4 days" value={String(snapshot?.fullFours ?? stats.fullFours)} />
        <Stat label="Best streak" value={String(snapshot?.bestStreak ?? stats.bestStreak)} />
        <Stat label={COUNCIL_NAME} value={snapshot ? `${snapshot.councilRank}/${snapshot.councilSize}` : "Live"} />
        <Stat label="Team rank" value={snapshot?.teamRank ? `${snapshot.teamRank}/${snapshot.teamSize}` : "—"} />
      </View>
      {QUADRANT_IDS.map((quadrant) => {
        const plan = plans.find((item) => item.quadrant === quadrant);
        const rated = review?.quadrants[quadrant];
        return (
          <Card key={quadrant}>
            <T variant="heading" color={quadrants[quadrant].text}>{quadrants[quadrant].label} · {execution[quadrant]}%</T>
            <Text style={styles.wrap}>Objective: {plan?.objective.trim() || "No objective set."}</Text>
            <Text style={styles.wrap}>Daily tactic: {plan?.tactic.trim() || "No tactic."}</Text>
            {plan?.secondaryTactic.trim() ? <Text style={styles.wrap}>Second tactic: {plan.secondaryTactic}</Text> : null}
            <Text style={styles.wrap}>Day 30: {plan?.checkpoint30.trim() || "—"} {plan?.checkpoint30Done ? "(reached)" : ""}</Text>
            <Text style={styles.wrap}>Day 60: {plan?.checkpoint60.trim() || "—"} {plan?.checkpoint60Done ? "(reached)" : ""}</Text>
            <T color={colors.textSecondary}>Review: {rated?.rating ?? "unrated"}{rated?.notes.trim() ? ` — ${rated.notes}` : ""}</T>
          </Card>
        );
      })}
      <Card>
        <T variant="heading">Non-negotiables</T>
        {items.length === 0 ? <T color={colors.textSecondary}>None recorded.</T> : items.map((item) => <Text key={item.id} style={styles.wrap}>• {item.label}</Text>)}
      </Card>
      <Card>
        <T variant="heading">Quarter debrief</T>
        <Text style={styles.wrap}>Sustain: {review?.sustain.trim() || "—"}</Text>
        <Text style={styles.wrap}>Improve: {review?.improve.trim() || "—"}</Text>
        <Text style={styles.wrap}>Adjust: {review?.adjust.trim() || "—"}</Text>
        <Text style={styles.wrap}>Carry forward: {review?.carryForward.trim() || "—"}</Text>
      </Card>
      <Card>
        <T variant="heading">Daily debriefs</T>
        {debriefs.length === 0 ? <T color={colors.textSecondary}>No daily debriefs in this quarter.</T> : null}
        {debriefs.map((log) => (
          <View key={log.date} style={styles.debrief}>
            <T>{formatLong(log.date)}</T>
            {log.sustain.trim() ? <Text style={styles.wrap}>Sustain: {log.sustain}</Text> : null}
            {log.improve.trim() ? <Text style={styles.wrap}>Improve: {log.improve}</Text> : null}
            {log.adjust.trim() ? <Text style={styles.wrap}>Adjust: {log.adjust}</Text> : null}
          </View>
        ))}
      </Card>
      <Card>
        <T variant="heading">Badges this quarter</T>
        <T>{badgeNames(snapshot?.badges ?? stats.badges) || "None yet."}</T>
      </Card>
      {editable ? <Button label="Edit on the Plan screen" onPress={() => router.push("/plan")} /> : <Button label="Reopen from Review" variant="secondary" onPress={() => router.push("/review")} />}
    </Page>
  );
}

export function ArchiveCompare() {
  const app = useApp();
  const options = app.archive.map((row) => ({ id: row.quarter.id, label: row.quarter.label }));
  const [leftId, setLeftId] = useState(options[1]?.id ?? options[0]?.id ?? "");
  const [rightId, setRightId] = useState(options[0]?.id ?? "");
  const left = app.archive.find((row) => row.quarter.id === leftId);
  const right = app.archive.find((row) => row.quarter.id === rightId);
  if (!left || !right) {
    return (
      <Page>
        <T variant="title">Compare</T>
        <T>You need two quarters on the record.</T>
      </Page>
    );
  }
  const comparison = compareArchives(left, right);
  return (
    <Page>
      <T variant="title">Compare quarters</T>
      <Segmented label="First quarter" value={leftId} onChange={setLeftId} options={options} />
      <Segmented label="Second quarter" value={rightId} onChange={setRightId} options={options} />
      <T>
        Points {comparison.pointsDelta >= 0 ? "+" : ""}
        {comparison.pointsDelta} from {left.quarter.label} to {right.quarter.label}. Best streak {comparison.streakDelta >= 0 ? "+" : ""}
        {comparison.streakDelta}.
      </T>
      <View style={styles.split}>
        <CompareColumn row={left} delta={comparison} side="left" />
        <CompareColumn row={right} delta={comparison} side="right" />
      </View>
    </Page>
  );
}

function CompareColumn({
  row,
  delta,
  side,
}: {
  row: ReturnType<typeof useApp>["archive"][number];
  delta: ReturnType<typeof compareArchives>;
  side: "left" | "right";
}) {
  const points = row.snapshot?.points ?? row.stats.points;
  return (
    <Card style={{ flex: 1, minWidth: 260 }}>
      <T variant="heading">{row.quarter.label}</T>
      <Text style={styles.wrap}>{row.quarter.vision.trim() || "No vision."}</Text>
      <T>{points} points · streak {row.snapshot?.bestStreak ?? row.stats.bestStreak}</T>
      <T color={colors.textSecondary}>
        {row.snapshot ? `${COUNCIL_NAME} ${row.snapshot.councilRank} of ${row.snapshot.councilSize}` : "Still open"}
      </T>
      {QUADRANT_IDS.map((quadrant: QuadrantId) => (
        <Text key={quadrant} style={styles.wrap}>
          {quadrants[quadrant].label}: {(row.snapshot?.execution[quadrant] ?? row.stats.execution[quadrant])}%
          {side === "right" ? ` (${delta.executionDelta[quadrant] >= 0 ? "+" : ""}${delta.executionDelta[quadrant]})` : ""}
        </Text>
      ))}
    </Card>
  );
}

export function AchievementsScreen() {
  const app = useApp();
  const life = app.lifetime;
  if (!life) return null;
  const earned = new Set([...app.lifetimeBadges, ...app.archive.flatMap((row) => row.snapshot?.badges ?? row.stats.badges)]);
  return (
    <Page>
      <T variant="title">Achievements</T>
      <T color={colors.textSecondary}>Lifetime numbers count every quarter on the record. Streaks can cross from one quarter into the next.</T>
      <View style={styles.tiles}>
        <Stat label="Quarters closed" value={String(life.quartersCompleted)} />
        <Stat label="Quarters started" value={String(life.quartersStarted)} />
        <Stat label="Lifetime points" value={String(life.lifetimePoints)} />
        <Stat label="Best streak" value={String(life.bestStreak)} />
        <Stat label="Full-4 days" value={String(life.fullFours)} />
        <Stat label="Days logged" value={String(life.daysLogged)} />
      </View>
      {allBadgeDefs().map((badge) => (
        <Card key={badge.id}>
          <T color={earned.has(badge.id) ? colors.brand : colors.textSecondary}>{earned.has(badge.id) ? badge.name : `${badge.name} · not yet`}</T>
          <T color={colors.textSecondary}>{badge.detail}</T>
          {LIFETIME_BADGES.some((item) => item.id === badge.id) ? <T variant="small" color={colors.textSecondary}>Lifetime</T> : <T variant="small" color={colors.textSecondary}>Earned inside a quarter</T>}
        </Card>
      ))}
    </Page>
  );
}

function badgeNames(ids: string[]): string {
  const defs = allBadgeDefs();
  return ids.map((id) => defs.find((badge) => badge.id === id)?.name ?? id).join(", ");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.tile}>
      <T variant="label" color={colors.textSecondary}>{label}</T>
      <T variant="title">{value}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wrap: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.text },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexGrow: 1, flexBasis: 160 },
  debrief: { gap: 4, paddingTop: 8 },
  split: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
