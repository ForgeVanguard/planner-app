import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Banner, Button, Card, GrowField, Page, Segmented, T } from "../components/ui";
import { clipToQuarter, formatCallTime, weekRangeContaining, weekdayName } from "../domain/weeks";
import { enumerateDays, formatMedium } from "../domain/dates";
import { quadrantScore } from "../domain/scoring";
import { useApp } from "../state/store";
import { colors, fonts } from "../theme";
import { SAMPLE_MEMBERS } from "../data/catalog";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TeamScreen() {
  const app = useApp();
  const [query, setQuery] = useState("");
  const [post, setPost] = useState("");
  const team = app.myTeam;
  const teams = app.teams.filter((item) => `${item.name} ${item.blurb}`.toLowerCase().includes(query.trim().toLowerCase()));
  if (!app.data || !app.week) return null;
  if (!team) {
    return (
      <Page>
        <T variant="title">Join a team</T>
        <T color={colors.textSecondary}>Each team keeps its own call day. Your weekly board will follow that week. Community standings stay on the shared quarter.</T>
        <TextInput accessibilityLabel="Search teams" value={query} onChangeText={setQuery} placeholder="Search teams" placeholderTextColor="#8E99A8" style={styles.search} />
        {teams.map((item) => (
          <Card key={item.id}>
            <T variant="heading">{item.name}</T>
            <T color={colors.textSecondary}>{item.blurb}</T>
            <T>Call {weekdayName(item.weekStartDay)} at {formatCallTime(item.callTime)} · {item.timeZone}. Week runs {weekdayName(item.weekStartDay)}–{weekdayName((item.weekStartDay + 6) % 7)}.</T>
            <Button label={`Join ${item.name}`} onPress={() => app.joinTeam(item.id)} />
          </Card>
        ))}
      </Page>
    );
  }
  const range = weekRangeContaining(app.today, team.weekStartDay);
  const days = clipToQuarter(range, app.currentQuarter?.startDate ?? range.start, app.currentQuarter?.endDate ?? range.end, app.today, true);
  const members = SAMPLE_MEMBERS.filter((member) => member.teamId === team.id);
  const isLeader = team.leaderId === app.data.profile.id;
  const posts = app.boardPosts.filter((item) => item.teamId === team.id);
  return (
    <Page
      aside={
        <Card>
          <T variant="heading">Call settings</T>
          <T color={colors.textSecondary}>
            Only the team leader sets the week. Members finalize numbers by the end of the day before the call. {isLeader ? "That's you, for this team." : `Leader: ${team.leaderName}.`}
          </T>
          {isLeader ? (
            <>
              <Segmented
                label="Call day and week start"
                value={String(team.weekStartDay)}
                onChange={(id) => app.saveTeamSettings(team.id, { weekStartDay: Number(id) })}
                options={DAYS.map((label, index) => ({ id: String(index), label: label.slice(0, 3) }))}
              />
              <GrowField label="Call time" hint="24-hour HH:MM" value={team.callTime} minHeight={64} onChangeText={(value) => app.saveTeamSettings(team.id, { callTime: value })} />
              <GrowField label="Timezone" hint="IANA name, such as America/New_York" value={team.timeZone} minHeight={64} onChangeText={(value) => app.saveTeamSettings(team.id, { timeZone: value })} />
            </>
          ) : (
            <Button
              label={app.data.leaderRequest?.teamId === team.id ? "Leadership request pending" : "Ask to lead this team"}
              variant="secondary"
              onPress={() => app.requestLead(team.id)}
            />
          )}
          {app.data.leaderRequest?.teamId === team.id ? (
            <T color={colors.textSecondary}>Request noted. A hosted project would send this to the current leader. It does not change the call day by itself.</T>
          ) : null}
        </Card>
      }
    >
      <T variant="title">{team.name}</T>
      <T color={colors.textSecondary}>{team.blurb}</T>
      <Banner
        title={app.week.closed ? "This week's numbers are closed" : `Week closes in ${app.week.closesInLabel}`}
        body={`${app.week.rangeLabel}. Finalize by ${app.week.finalizeBy}, before the ${app.week.callLabel} call. Only your team sees this board.`}
      />
      <Card>
        <T variant="heading">This week's check-offs</T>
        <T color={colors.textSecondary}>Dots are quadrant scores for the team week, not the community rank.</T>
        <MemberWeek name={`${app.data.profile.name} (you)`} scores={days.map((date) => quadrantScore(app.logFor(date)))} days={days} />
        {members.map((member) => (
          <MemberWeek
            key={member.userId}
            name={member.visibility === "private" ? `${member.name} · plan private` : member.name}
            scores={days.map((date) => hashScore(`${member.userId}:${date}`))}
            days={days}
          />
        ))}
      </Card>
      <Card>
        <T variant="heading">Board</T>
        <GrowField label="Post to the team" value={post} onChangeText={setPost} minHeight={96} placeholder="What should the call know?" />
        <Button
          label="Post"
          onPress={() => {
            app.addPost(post);
            setPost("");
          }}
        />
        {posts.map((item) => (
          <View key={item.id} style={styles.post}>
            <T>{item.authorName}</T>
            <Text style={styles.body}>{item.body}</Text>
            <T variant="small" color={colors.textSecondary}>{formatMedium(item.createdAt.slice(0, 10))}</T>
          </View>
        ))}
      </Card>
      <Button label="Leave this team" variant="ghost" onPress={() => app.updateProfile("teamId", null)} />
    </Page>
  );
}

function MemberWeek({ name, scores, days }: { name: string; scores: number[]; days: string[] }) {
  return (
    <View style={styles.member}>
      <Text style={styles.body}>{name}</Text>
      <View style={styles.dots}>
        {(days.length ? days : enumerateDays("2026-01-01", "2026-01-01")).map((date, index) => (
          <View key={date} accessibilityLabel={`${formatMedium(date)} score ${scores[index] ?? 0}`} style={[styles.dot, { opacity: 0.35 + ((scores[index] ?? 0) / 4) * 0.65 }]} />
        ))}
      </View>
    </View>
  );
}

function hashScore(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 33 + value.charCodeAt(i)) >>> 0;
  return h % 5;
}

const styles = StyleSheet.create({
  search: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 14, fontSize: 17, fontFamily: fonts.body },
  member: { gap: 6, paddingVertical: 6 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 16, height: 16, borderRadius: 4, backgroundColor: colors.brand },
  post: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.text },
});
