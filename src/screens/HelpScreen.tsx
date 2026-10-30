import { ScrollView, StyleSheet, Text } from "react-native";
import { Card, T } from "../components/ui";
import { APP_NAME, COUNCIL_NAME, DEFAULT_QUARTER_LENGTH } from "../config";
import { MAX_DAILY_POINTS, POINT_RULES, QUARTER_BADGES } from "../domain/scoring";
import { LIFETIME_BADGES } from "../domain/stats";
import { colors, fonts, quadrants } from "../theme";
import { QUADRANT_IDS } from "../types";

export function HelpScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <T variant="title">How {APP_NAME} works</T>
      <T color={colors.textSecondary}>A quarter is long enough to change and short enough to finish. {DEFAULT_QUARTER_LENGTH} days is 13 weeks, counting the start date and the end date. You can set another length on the Plan screen.</T>
      <Card>
        <T variant="heading">The four quadrants</T>
        {QUADRANT_IDS.map((quadrant) => (
          <Text key={quadrant} style={styles.body}>
            <Text style={{ color: quadrants[quadrant].text }}>{quadrants[quadrant].label}. </Text>
            {quadrants[quadrant].hint}.
          </Text>
        ))}
      </Card>
      <Card>
        <T variant="heading">A day</T>
        <Text style={styles.body}>Each quadrant has one daily tactic and an optional second tactic. There is one checkbox for the tactic. Non-negotiables are the floors under the day, up to six. The After Action Review is three lines: Sustain, Improve, Adjust. It saves as you type.</Text>
      </Card>
      <Card>
        <T variant="heading">Points</T>
        {POINT_RULES.map((rule) => (
          <Text key={rule.id} style={styles.body}>{rule.points} point{rule.points === 1 ? "" : "s"} — {rule.label}.</Text>
        ))}
        <Text style={styles.body}>A day tops out at {MAX_DAILY_POINTS} when non-negotiables are set. "Logged after 7pm" only says when you recorded the day. It does not change the points.</Text>
      </Card>
      <Card>
        <T variant="heading">Team weeks and the {COUNCIL_NAME}</T>
        <Text style={styles.body}>Each team picks the weekday of its call. That day starts the team week. A Thursday team runs Thursday through Wednesday. Members finalize the week's numbers by the end of the day before the call. After that, edits are locked unless you file a late correction, which stays flagged.</Text>
        <Text style={styles.body}>Weekly radar, the team board, weekly check-offs, and week exports follow that team week. Quarter points, streaks, and {COUNCIL_NAME} standings stay on the shared quarter calendar, so a Monday team and a Thursday team are still compared fairly.</Text>
        <Text style={styles.body}>If you were offline, an edit timestamped before the cutoff still counts as on time when it syncs. A day's log is never dropped to resolve a conflict. Fields merge by the later timestamp.</Text>
      </Card>
      <Card>
        <T variant="heading">Badges</T>
        {QUARTER_BADGES.map((badge) => (
          <Text key={badge.id} style={styles.body}>{badge.name}: {badge.detail}</Text>
        ))}
        {LIFETIME_BADGES.map((badge) => (
          <Text key={badge.id} style={styles.body}>{badge.name}: {badge.detail}</Text>
        ))}
      </Card>
      <Card>
        <T variant="heading">Archive</T>
        <Text style={styles.body}>Closed quarters remain on the record with their vision, plan, checkpoints, review, debriefs, execution, points, streaks, team rank, and {COUNCIL_NAME} rank. You can compare any two and see the trend across quarters. Exports include all of them.</Text>
      </Card>
      <Card>
        <T variant="heading">Offline</T>
        <Text style={styles.body}>Check-offs, debriefs, and plan edits save on the device first. The bar at the top says when you're offline and how many changes are waiting. They sync when the connection returns. In demo mode you can flip Offline in Profile to see it.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, gap: 16 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.text },
});
