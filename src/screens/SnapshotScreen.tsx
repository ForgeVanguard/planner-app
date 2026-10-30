import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Heatmap, Radar } from "../components/charts";
import { Banner, Button, Card, Page, Pill, Segmented, T } from "../components/ui";
import { COUNCIL_NAME } from "../config";
import { clipToQuarter } from "../domain/weeks";
import { executionForDates, QUARTER_BADGES, badgeById } from "../domain/scoring";
import { weekReport } from "../domain/export-data";
import { activeNonNegotiables } from "../domain/model";
import { copyText, downloadShareCard, shareText } from "../lib/share";
import { useApp } from "../state/store";
import { colors } from "../theme";

export function SnapshotScreen() {
  const app = useApp();
  const router = useRouter();
  const quarters = app.data?.quarters.filter((quarter) => quarter.status !== "draft") ?? [];
  const [quarterId, setQuarterId] = useState(app.currentQuarter?.id ?? quarters[0]?.id ?? "");
  const [window, setWindow] = useState<"week" | "last" | "quarter">("week");
  const quarter = quarters.find((item) => item.id === quarterId) ?? app.currentQuarter;
  if (!quarter || !app.week || !app.data) {
    return (
      <Page>
        <T variant="title">Snapshot</T>
        <T color={colors.textSecondary}>Log a few days and this fills in.</T>
      </Page>
    );
  }
  const stats = app.statsFor(quarter.id);
  const plans = app.data.plans[quarter.id] ?? [];
  const items = activeNonNegotiables(app.data.nonNegotiables[quarter.id]);
  const range = window === "last" ? app.week.lastRange : app.week.range;
  const dates =
    window === "quarter"
      ? stats
        ? []
        : []
      : clipToQuarter(range, quarter.startDate, quarter.endDate, app.today, false);
  const execution =
    window === "quarter"
      ? stats?.execution ?? null
      : executionForDates(dates, app.data.logs.filter((log) => log.quarterId === quarter.id));
  const caption =
    window === "quarter"
      ? `Quarter to date on the shared calendar. ${COUNCIL_NAME} uses this, not the team week.`
      : `${window === "last" ? "Last" : "This"} ${app.week.teamName ?? "personal"} week · ${window === "last" ? "" : app.week.rangeLabel}`;
  const badges = stats?.badges ?? [];
  return (
    <Page
      aside={
        <Card>
          <T variant="heading">Badges</T>
          <T color={colors.textSecondary}>Earned from the best streak and full days in this quarter. They stay if the current streak resets.</T>
          {QUARTER_BADGES.map((badge) => {
            const earned = badges.includes(badge.id);
            return (
              <View key={badge.id} style={{ gap: 4 }}>
                <T color={earned ? colors.brand : colors.textSecondary}>{earned ? badge.name : `${badge.name} · locked`}</T>
                <T variant="small" color={colors.textSecondary}>{badge.detail}</T>
                {earned ? (
                  <Button
                    label={`Share ${badge.name}`}
                    variant="ghost"
                    onPress={() => void shareText(`I earned ${badge.name} in this quarter. ${badge.detail}`)}
                  />
                ) : null}
              </View>
            );
          })}
        </Card>
      }
    >
      <T variant="title">Snapshot</T>
      <Segmented label="Quarter" value={quarter.id} onChange={setQuarterId} options={quarters.map((item) => ({ id: item.id, label: item.label }))} />
      <View style={styles.tiles}>
        <Tile label="Streak" value={String(stats?.currentStreak ?? 0)} detail={`Best ${stats?.bestStreak ?? 0}`} />
        <Tile label="Points" value={String(stats?.points ?? 0)} detail="Quarter total" />
        <Tile label="Full 4s" value={String(stats?.fullFours ?? 0)} detail="All four quadrants" />
      </View>
      <Banner
        title={app.week.closed ? "Team week closed" : `Week closes in ${app.week.closesInLabel}`}
        body={`Finalize by ${app.week.finalizeBy}. ${app.week.councilNote}`}
      />
      <Card>
        <Segmented
          label="Radar window"
          value={window}
          onChange={(id) => setWindow(id as "week" | "last" | "quarter")}
          options={[
            { id: "week", label: "This team week" },
            { id: "last", label: "Last team week" },
            { id: "quarter", label: "Quarter" },
          ]}
        />
        <Radar values={execution} caption={caption} />
        <View style={styles.actions}>
          <Button
            label="Copy week report"
            variant="secondary"
            onPress={() => {
              const report = weekReport({
                quarterLabel: quarter.label,
                rangeLabel: app.week?.rangeLabel ?? "",
                dates: clipToQuarter(app.week!.range, quarter.startDate, quarter.endDate, app.today, false),
                logs: app.data!.logs,
                items,
                councilNote: app.week!.councilNote,
              });
              void copyText(report);
            }}
          />
          <Button
            label="Save week image"
            variant="secondary"
            onPress={() =>
              void downloadShareCard(`${quarter.label} week`, [
                app.week?.rangeLabel ?? "",
                `Points ${stats?.points ?? 0}`,
                `Streak ${stats?.currentStreak ?? 0}`,
                `Full days ${stats?.fullFours ?? 0}`,
              ])
            }
          />
        </View>
      </Card>
      <Card>
        <T variant="heading">Quarter tracker</T>
        <Heatmap quarter={quarter} logs={app.data.logs.filter((log) => log.quarterId === quarter.id)} today={app.today} callDay={app.week.weekStartDay} onPick={(day) => router.push(`/?day=${day}`)} />
      </Card>
      <Card>
        <T variant="heading">How the points add up</T>
        <T>Tactics {stats?.breakdown.tactics ?? 0} · Full-day bonus {stats?.breakdown.fullBonus ?? 0} · Non-negotiables {stats?.breakdown.nonNegotiables ?? 0} · Debriefs {stats?.breakdown.debriefs ?? 0}</T>
        <T color={colors.textSecondary}>
          Logged after 7pm on {stats?.eveningLogs ?? 0} days. That mark is a timestamp, not a penalty. {badges.map((id) => badgeById(id)?.name).filter(Boolean).join(", ") || "No badges yet."}
        </T>
        <Button label="See the full archive" variant="ghost" onPress={() => router.push("/archive")} />
      </Card>
      {plans.length ? null : <Pill text="Plan still empty" />}
    </Page>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card style={styles.tile}>
      <T variant="label" color={colors.textSecondary}>{label}</T>
      <T variant="display">{value}</T>
      <T color={colors.textSecondary}>{detail}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexGrow: 1, flexBasis: 180 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
