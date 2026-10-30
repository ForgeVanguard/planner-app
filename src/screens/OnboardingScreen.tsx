import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, T } from "../components/ui";
import { APP_NAME, COUNCIL_NAME, DEFAULT_QUARTER_LENGTH } from "../config";
import { useApp } from "../state/store";
import { colors, quadrants } from "../theme";
import { QUADRANT_IDS } from "../types";

const STEPS = [
  {
    title: "Four parts of the quarter",
    body: "Calibration, Connection, Condition, and Contribution. Each one gets an objective, a daily tactic, and two checkpoints.",
  },
  {
    title: "The day is short on purpose",
    body: "Check the tactic once. Add up to six non-negotiables. Close with Sustain, Improve, Adjust. The words wrap. Nothing stays stuck on Working.",
  },
  {
    title: `Your team week, the ${COUNCIL_NAME} quarter`,
    body: "Your team's call day starts its week. Finish the numbers the day before the call. Standings across every team still use the shared quarter, so the comparison stays fair.",
  },
  {
    title: "It keeps the record",
    body: `A quarter is ${DEFAULT_QUARTER_LENGTH} days unless you change it. Closed quarters stay in the archive, with the plan, the review, and the numbers. You can work offline. The changes sync when you're back.`,
  },
];

export function OnboardingScreen() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  return (
    <View style={styles.screen}>
      <T variant="label" color={colors.brand}>{APP_NAME}</T>
      <T variant="title">{current.title}</T>
      <T color={colors.textSecondary}>{current.body}</T>
      {step === 0 ? (
        <Card>
          {QUADRANT_IDS.map((quadrant) => (
            <T key={quadrant} color={quadrants[quadrant].text}>
              {quadrants[quadrant].label} — {quadrants[quadrant].hint}
            </T>
          ))}
        </Card>
      ) : null}
      <View style={styles.row}>
        {step > 0 ? <Button label="Back" variant="secondary" onPress={() => setStep((value) => value - 1)} /> : null}
        {step < STEPS.length - 1 ? (
          <Button label="Next" onPress={() => setStep((value) => value + 1)} />
        ) : (
          <Button label="Start the quarter" onPress={app.completeOnboarding} />
        )}
        <Button label="Skip" variant="ghost" onPress={app.completeOnboarding} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center", gap: 16, maxWidth: 720, alignSelf: "center", width: "100%" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
