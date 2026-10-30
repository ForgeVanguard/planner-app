import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Banner, Button, Card, Page, Pill, Segmented, T } from "../components/ui";
import { COUNCIL_NAME } from "../config";
import { clipToQuarter } from "../domain/weeks";
import { POINT_RULES, QUARTER_BADGES } from "../domain/scoring";
import { toCSV, toJSON, toMarkdown, weekReport } from "../domain/export-data";
import { activeNonNegotiables } from "../domain/model";
import { copyText, downloadShareCard, downloadText, shareText } from "../lib/share";
import { useApp } from "../state/store";
import { colors, fonts } from "../theme";

export function StandingsScreen() {
  const app = useApp();
  const [scope, setScope] = useState<"council" | "team">("council");
  const [teamQuery, setTeamQuery] = useState("");
  const [teamId, setTeamId] = useState(app.myTeam?.id ?? "all");
  const quarter = app.currentQuarter;
  const teams = app.teams.filter((team) => `${team.name} ${team.blurb}`.toLowerCase().includes(teamQuery.trim().toLowerCase()));
  const rows = quarter ? app.standingsFor(quarter.id, scope) : [];
  const filtered = useMemo(() => {
    if (scope === "team") return rows;
    if (teamId === "all") return rows;
    return rows.filter((row) => row.userId === app.data?.profile.id || row.teamId === teamId);
  }, [rows, scope, teamId, app.data?.profile.id]);
  const me = filtered.find((row) => row.userId === app.data?.profile.id);
  const rank = me ? filtered.findIndex((row) => row.userId === me.userId) + 1 : null;
  if (!quarter || !app.week || !app.data) return null;
  const report = () =>
    weekReport({
      quarterLabel: quarter.label,
      rangeLabel: app.week!.rangeLabel,
      dates: clipToQuarter(app.week!.range, quarter.startDate, quarter.endDate, app.today, false),
      logs: app.data!.logs,
      items: activeNonNegotiables(app.data!.nonNegotiables[quarter.id]),
      councilNote: app.week!.councilNote,
    });
  return (
    <Page
      aside={
        <Card>
          <T variant="heading">How points work</T>
          <T color={colors.textSecondary}>
            {COUNCIL_NAME} standings use the whole quarter, the same calendar for every team. A Thursday team and a Monday team are compared on quarter points, not on whose call happened to fall this week.
          </T>
          {POINT_RULES.map((rule) => (
            <Text key={rule.id} style={styles.line}>
              {rule.points > 0 ? `+${rule.points}` : rule.points} · {rule.label}
            </Text>
          ))}
          <T color={colors.textSecondary}>Maximum is 8 in a day when non-negotiables are set, 7 when they aren't. Logged after 7pm is only a timestamp.</T>
          <T variant="heading">Badges</T>
          {QUARTER_BADGES.map((badge) => (
            <Text key={badge.id} style={styles.line}>
              {badge.name}: {badge.detail}
            </Text>
          ))}
        </Card>
      }
    >
      <T variant="title">{scope === "council" ? `${COUNCIL_NAME} standings` : `${app.myTeam?.name ?? "Team"} standings`}</T>
      <T color={colors.textSecondary}>{quarter.label} · quarter points only.</T>
      <Segmented
        label="Standing scope"
        value={scope}
        onChange={(id) => setScope(id as "council" | "team")}
        options={[
          { id: "council", label: COUNCIL_NAME },
          { id: "team", label: "My team" },
        ]}
      />
      {scope === "council" ? (
        <Card>
          <T variant="heading">Filter by team</T>
          <TextInput
            accessibilityLabel="Search teams"
            value={teamQuery}
            onChangeText={setTeamQuery}
            placeholder="Search teams"
            placeholderTextColor="#8E99A8"
            style={styles.search}
          />
          <Segmented
            label="Team filter"
            value={teamId}
            onChange={setTeamId}
            options={[{ id: "all", label: "All teams" }, ...teams.map((team) => ({ id: team.id, label: team.name }))]}
          />
        </Card>
      ) : null}
      {app.data.profile.visibility === "private" ? (
        <Banner title="Only you can see your row" body="Plan visibility is set to Only me. Other members won't see you on the board." />
      ) : null}
      {me && rank ? (
        <Card>
          <T variant="heading">You are {rank} of {filtered.length}</T>
          <T>{me.points} quarter points · {me.daysLogged} days · streak {me.currentStreak}</T>
          <Button label="Share your rank" variant="secondary" onPress={() => void shareText(`${app.data?.profile.name} is ${rank} of ${filtered.length} in ${quarter.label} with ${me.points} points.`)} />
        </Card>
      ) : null}
      {filtered.map((row, index) => (
        <Card key={row.userId} style={row.userId === app.data?.profile.id ? styles.mine : undefined}>
          <View style={styles.rankRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <T>{row.name}{row.userId === app.data?.profile.id ? " · you" : ""}</T>
              <T variant="small" color={colors.textSecondary}>
                {app.teams.find((team) => team.id === row.teamId)?.name ?? "No team"}
                {row.visibility === "team" ? " · visible to the team" : ""}
                {row.eveningLogs > 0 ? ` · logged after 7pm on ${row.eveningLogs} days, not a penalty` : ""}
              </T>
            </View>
            <Pill text={`${row.points} pts`} />
          </View>
          <T variant="small" color={colors.textSecondary}>
            {row.daysLogged} days · {row.fullFours} full-4 days · streak {row.currentStreak}
            {row.badges.length ? ` · ${row.badges.join(", ")}` : ""}
          </T>
        </Card>
      ))}
      <Card>
        <T variant="heading">Export</T>
        <T color={colors.textSecondary}>The full record includes every quarter, not just this week. Week exports follow your team's call week.</T>
        <View style={styles.actions}>
          <Button label="Copy this team week" variant="secondary" onPress={() => void copyText(report())} />
          <Button label="Week image" variant="secondary" onPress={() => void downloadShareCard(`${quarter.label} week`, [report()])} />
          <Button label="JSON" variant="secondary" onPress={() => void downloadText("planner-app.json", toJSON(app.data!, new Date().toISOString()), "application/json")} />
          <Button label="CSV" variant="secondary" onPress={() => void downloadText("planner-app.csv", toCSV(app.data!), "text/csv")} />
          <Button label="Markdown" variant="secondary" onPress={() => void downloadText("planner-app.md", toMarkdown(app.data!), "text/markdown")} />
        </View>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  line: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.text },
  search: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 17,
    fontFamily: fonts.body,
  },
  rankRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  rank: { fontFamily: fonts.display, fontSize: 28, color: colors.brand, width: 40 },
  mine: { borderColor: colors.brand },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
