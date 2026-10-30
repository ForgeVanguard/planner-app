import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Banner, Button, Card, GrowField, Page, Segmented, T } from "../components/ui";
import { DEFAULT_QUARTER_LENGTH, MAX_NON_NEGOTIABLES } from "../config";
import { formatLong, isISODate } from "../domain/dates";
import { endFromLength } from "../domain/model";
import { activeNonNegotiables } from "../domain/model";
import { isQuarterEditable, quarterLength } from "../domain/quarters";
import { useApp } from "../state/store";
import { colors, quadrants } from "../theme";
import type { QuadrantId, Quarter } from "../types";
import { QUADRANT_IDS } from "../types";

export function PlanScreen() {
  const app = useApp();
  const router = useRouter();
  const [which, setWhich] = useState<"current" | "draft">("current");
  const quarter = which === "draft" ? app.draftQuarter : app.currentQuarter;
  const editable = isQuarterEditable(quarter);
  if (!app.data) return null;
  return (
    <Page
      aside={
        <Card>
          <T variant="heading">One place to edit</T>
          <T color={colors.textSecondary}>
            Vision, objectives, tactics, non-negotiables, and checkpoints live here. Today only checks the day off. Closed quarters stay read-only until you reopen them from Review. Every quarter stays in the Archive.
          </T>
          <Button label="Open the archive" variant="secondary" onPress={() => router.push("/archive")} />
        </Card>
      }
    >
      <T variant="title">Quarter plan</T>
      <Segmented
        label="Which quarter"
        value={which}
        onChange={(id) => setWhich(id as "current" | "draft")}
        options={[
          { id: "current", label: app.currentQuarter?.label ?? "This quarter" },
          { id: "draft", label: app.draftQuarter ? `${app.draftQuarter.label} draft` : "Next quarter" },
        ]}
      />
      {which === "draft" && !app.draftQuarter ? (
        <Card>
          <T>There isn't a draft yet.</T>
          <Button label="Copy from the current quarter" onPress={app.copyCurrentToDraft} />
        </Card>
      ) : null}
      {quarter ? (
        <QuarterEditor key={quarter.id} quarter={quarter} editable={editable} showCopy={which === "draft"} />
      ) : null}
    </Page>
  );
}

function QuarterEditor({ quarter, editable, showCopy }: { quarter: Quarter; editable: boolean; showCopy: boolean }) {
  const app = useApp();
  const plans = app.data?.plans[quarter.id] ?? [];
  const items = app.data?.nonNegotiables[quarter.id] ?? [];
  const active = activeNonNegotiables(items);
  const length = quarterLength(quarter.startDate, quarter.endDate);
  const [startDraft, setStartDraft] = useState(quarter.startDate);
  const [lengthDraft, setLengthDraft] = useState(String(length));
  return (
    <View style={{ gap: 16 }}>
      {!editable ? (
        <Banner title="Read-only" body="This quarter is closed. Reopen it from Review if you need to change the plan. The archive keeps the frozen numbers." tone="danger" />
      ) : null}
      {quarter.carryForwardNote.trim() ? <Banner title="Carried from the last review" body={quarter.carryForwardNote} /> : null}
      {showCopy ? <Button label="Copy from the current quarter" variant="secondary" onPress={app.copyCurrentToDraft} /> : null}
      <Card>
        <T variant="heading">Quarter setup</T>
        <T color={colors.textSecondary}>
          {length} days · {formatLong(quarter.startDate)} – {formatLong(quarter.endDate)}. A quarter is {DEFAULT_QUARTER_LENGTH} days, 13 weeks, unless you set another length. The count includes the start and the end.
        </T>
        <GrowField label="Label" value={quarter.label} editable={editable} minHeight={64} onChangeText={(value) => app.updateQuarter(quarter.id, "label", value)} />
        <GrowField
          label="Start date"
          hint="Use YYYY-MM-DD. It saves when the date is real."
          value={startDraft}
          editable={editable}
          minHeight={64}
          onChangeText={(value) => {
            setStartDraft(value);
            if (isISODate(value)) {
              app.updateQuarter(quarter.id, "startDate", value);
              app.updateQuarter(quarter.id, "endDate", endFromLength(value, length));
            }
          }}
        />
        <GrowField
          label="Length in days"
          hint="Between 28 and 120. It saves when the number is in range."
          value={lengthDraft}
          editable={editable}
          minHeight={64}
          onChangeText={(value) => {
            setLengthDraft(value);
            const next = Number(value);
            if (Number.isFinite(next) && next >= 28 && next <= 120) {
              app.updateQuarter(quarter.id, "endDate", endFromLength(quarter.startDate, next));
            }
          }}
        />
      </Card>
      <GrowField
        label="Vision"
        value={quarter.vision}
        editable={editable}
        minHeight={140}
        placeholder="What does a good end to this quarter look like?"
        onChangeText={(value) => app.updateQuarter(quarter.id, "vision", value)}
      />
      <View style={styles.grid}>
        {QUADRANT_IDS.map((quadrant) => {
          const plan = plans.find((item) => item.quadrant === quadrant);
          if (!plan) return null;
          return <QuadrantEditor key={quadrant} quarterId={quarter.id} quadrant={quadrant} editable={editable} />;
        })}
      </View>
      <Card>
        <T variant="heading">Non-negotiables · {active.length}/{MAX_NON_NEGOTIABLES}</T>
        <T color={colors.textSecondary}>Daily floors. They wrap, and you can write more than one line.</T>
        {items.filter((item) => !item.deleted).map((item) => (
          <View key={item.id} style={{ gap: 8 }}>
            <GrowField label="Non-negotiable" value={item.label} editable={editable} minHeight={72} onChangeText={(value) => app.saveNonNegotiable(quarter.id, item.id, value)} />
            {editable ? <Button label="Remove" variant="ghost" onPress={() => app.removeNonNegotiable(quarter.id, item.id)} /> : null}
          </View>
        ))}
        {editable && active.length < MAX_NON_NEGOTIABLES ? <Button label="Add a non-negotiable" variant="secondary" onPress={() => app.addNonNegotiable(quarter.id)} /> : null}
      </Card>
    </View>
  );
}

function QuadrantEditor({ quarterId, quadrant, editable }: { quarterId: string; quadrant: QuadrantId; editable: boolean }) {
  const app = useApp();
  const plan = app.data?.plans[quarterId]?.find((item) => item.quadrant === quadrant);
  if (!plan) return null;
  const theme = quadrants[quadrant];
  return (
    <Card style={{ borderColor: theme.color, flexGrow: 1, flexBasis: 320 }}>
      <T variant="heading" color={theme.text}>{theme.label}</T>
      <T color={colors.textSecondary}>{theme.hint}</T>
      <GrowField label="Objective" value={plan.objective} editable={editable} placeholder="What will be true by the end of the quarter?" onChangeText={(value) => app.updatePlan(quarterId, quadrant, "objective", value)} />
      <GrowField label="Daily tactic" value={plan.tactic} editable={editable} placeholder="The one action you can do today." onChangeText={(value) => app.updatePlan(quarterId, quadrant, "tactic", value)} />
      <GrowField label="Second tactic (optional)" value={plan.secondaryTactic} editable={editable} onChangeText={(value) => app.updatePlan(quarterId, quadrant, "secondaryTactic", value)} />
      <GrowField label="Day-30 checkpoint" value={plan.checkpoint30} editable={editable} onChangeText={(value) => app.updatePlan(quarterId, quadrant, "checkpoint30", value)} />
      <GrowField label="Day-60 checkpoint" value={plan.checkpoint60} editable={editable} onChangeText={(value) => app.updatePlan(quarterId, quadrant, "checkpoint60", value)} />
      {editable ? (
        <View style={{ gap: 8 }}>
          <Button
            label={plan.checkpoint30Done ? "Day 30 marked reached" : "Mark day 30 reached"}
            variant="secondary"
            onPress={() => app.updatePlan(quarterId, quadrant, "checkpoint30Done", !plan.checkpoint30Done)}
          />
          <Button
            label={plan.checkpoint60Done ? "Day 60 marked reached" : "Mark day 60 reached"}
            variant="secondary"
            onPress={() => app.updatePlan(quarterId, quadrant, "checkpoint60Done", !plan.checkpoint60Done)}
          />
        </View>
      ) : (
        <T color={colors.textSecondary}>
          Day 30 {plan.checkpoint30Done ? "reached" : "not marked"}. Day 60 {plan.checkpoint60Done ? "reached" : "not marked"}.
        </T>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
});
