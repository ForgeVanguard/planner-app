import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Radar } from "../components/charts";
import { Banner, Button, Card, GrowField, Page, Segmented, T } from "../components/ui";
import { suggestRating } from "../domain/scoring";
import { copyText } from "../lib/share";
import { useApp } from "../state/store";
import { colors, fonts, quadrants } from "../theme";
import type { QuadrantId, Rating } from "../types";
import { QUADRANT_IDS } from "../types";

const RATINGS: { id: Rating; label: string }[] = [
  { id: "hit", label: "Hit" },
  { id: "partial", label: "Partial" },
  { id: "missed", label: "Missed" },
];

export function ReviewScreen() {
  const app = useApp();
  const quarters = app.data?.quarters.filter((quarter) => quarter.status !== "draft" && quarter.startDate <= app.today) ?? [];
  const [quarterId, setQuarterId] = useState(app.currentQuarter?.id ?? quarters[0]?.id ?? "");
  const [confirm, setConfirm] = useState(false);
  const quarter = quarters.find((item) => item.id === quarterId);
  if (!quarter || !app.data) {
    return (
      <Page>
        <T variant="title">Quarter review</T>
        <T color={colors.textSecondary}>Nothing to review yet.</T>
      </Page>
    );
  }
  const stats = app.statsFor(quarter.id);
  const review = app.data.reviews[quarter.id];
  const plans = app.data.plans[quarter.id] ?? [];
  const closed = quarter.status === "closed";
  return (
    <Page
      aside={
        <Card>
          <T variant="heading">How to rate</T>
          <T color={colors.textSecondary}>
            Hit is about 80% or better. Partial is 40% to 79%. Missed is under 40%. The suggestion follows the days you actually logged. A quadrant with no objective is not a miss — write the objective on the Plan screen first.
          </T>
          {stats ? <Radar values={stats.execution} caption={`Execution across ${stats.elapsedDays} days.`} /> : null}
        </Card>
      }
    >
      <T variant="title">Quarter review</T>
      <Segmented label="Quarter to review" value={quarter.id} onChange={setQuarterId} options={quarters.map((item) => ({ id: item.id, label: item.label }))} />
      <T color={colors.textSecondary}>{quarter.vision.trim() || "No vision was written for this quarter."}</T>
      {closed ? <Banner title="Closed" body="The plan is read-only and the final numbers are frozen in the archive. Reopen if you closed it by mistake." tone="ok" /> : null}
      {QUADRANT_IDS.map((quadrant) => {
        const plan = plans.find((item) => item.quadrant === quadrant);
        const objective = plan?.objective.trim() ?? "";
        const percent = stats?.execution[quadrant] ?? 0;
        const suggestion = objective && (stats?.elapsedDays ?? 0) > 0 ? suggestRating(percent) : null;
        const entry = review?.quadrants[quadrant];
        return (
          <Card key={quadrant} style={{ borderColor: quadrants[quadrant].color }}>
            <T variant="heading" color={quadrants[quadrant].text}>{quadrants[quadrant].label}</T>
            <Text style={styles.wrap}>{objective || "No objective set."}</Text>
            <T color={colors.textSecondary}>{objective ? `${percent}% of elapsed days executed this tactic.` : "Add an objective before you rate this quadrant."}</T>
            {suggestion ? <T>Suggestion from the numbers: {suggestion}.</T> : null}
            {objective ? (
              <Segmented
                label={`${quadrants[quadrant].label} rating`}
                value={entry?.rating ?? ""}
                onChange={(id) => app.updateReview(quarter.id, `quadrant.${quadrant}.rating`, id as Rating)}
                options={RATINGS}
              />
            ) : (
              <Banner title="Not rated" body="This quadrant has no objective, so it is left unrated instead of being marked missed." />
            )}
            <GrowField
              label="Notes"
              value={entry?.notes ?? ""}
              editable={Boolean(objective)}
              onChangeText={(value) => app.updateReview(quarter.id, `quadrant.${quadrant}.notes`, value)}
            />
          </Card>
        );
      })}
      <Card>
        <T variant="heading">Debrief the quarter</T>
        <GrowField label="Sustain" value={review?.sustain ?? ""} onChangeText={(value) => app.updateReview(quarter.id, "sustain", value)} />
        <GrowField label="Improve" value={review?.improve ?? ""} onChangeText={(value) => app.updateReview(quarter.id, "improve", value)} />
        <GrowField label="Adjust" value={review?.adjust ?? ""} onChangeText={(value) => app.updateReview(quarter.id, "adjust", value)} />
        <GrowField label="Carry forward to the next quarter" value={review?.carryForward ?? ""} onChangeText={(value) => app.updateReview(quarter.id, "carryForward", value)} />
      </Card>
      <View style={styles.actions}>
        <Button
          label="Copy review"
          variant="secondary"
          onPress={() => {
            const lines = QUADRANT_IDS.map((quadrant: QuadrantId) => {
              const plan = plans.find((item) => item.quadrant === quadrant);
              const entry = review?.quadrants[quadrant];
              return `${quadrants[quadrant].label}: ${plan?.objective.trim() || "No objective"} — ${entry?.rating ?? "unrated"}. ${entry?.notes ?? ""}`;
            });
            void copyText([quarter.label, quarter.vision, ...lines, review?.carryForward ?? ""].join("\n\n"));
          }}
        />
        {closed ? (
          <Button label="Reopen quarter" onPress={() => app.reopenQuarter(quarter.id)} />
        ) : confirm ? (
          <>
            <Button label="Confirm close" onPress={() => { app.closeQuarter(quarter.id); setConfirm(false); }} />
            <Button label="Keep it open" variant="ghost" onPress={() => setConfirm(false)} />
          </>
        ) : (
          <Button label="Close this quarter" onPress={() => setConfirm(true)} />
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  wrap: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.text },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
