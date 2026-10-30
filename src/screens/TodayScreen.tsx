import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Banner, Button, Card, CheckRow, GrowField, Page, Pill, QuadrantDot, T, useBreakpoint } from "../components/ui";
import { APP_NAME } from "../config";
import { addDays, formatMedium, formatWeekday } from "../domain/dates";
import { activeNonNegotiables } from "../domain/model";
import { checkpointDate, dayNumber, daysLeftInclusive, quarterLength } from "../domain/quarters";
import { quadrantScore } from "../domain/scoring";
import { dayLock, logIsLate } from "../domain/weeks";
import { useApp } from "../state/store";
import { colors, fonts, quadrants } from "../theme";
import type { QuadrantId } from "../types";
import { QUADRANT_IDS } from "../types";

export function TodayScreen() {
  const app = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const { desktop } = useBreakpoint();
  const quarter = app.currentQuarter;
  const today = app.today;
  const requested = typeof params.day === "string" ? params.day : today;
  const date = quarter && requested >= quarter.startDate && requested <= today && requested <= quarter.endDate ? requested : today;
  const log = app.logFor(date);
  const plans = quarter ? app.data?.plans[quarter.id] ?? [] : [];
  const items = quarter ? activeNonNegotiables(app.data?.nonNegotiables[quarter.id]) : [];
  const lock = quarter
    ? dayLock({
        date,
        today,
        inQuarter: date >= quarter.startDate && date <= quarter.endDate,
        quarterClosed: quarter.status === "closed",
        weekStartDay: app.week?.weekStartDay ?? 1,
        timeZone: app.week?.timeZone ?? "UTC",
        now: new Date(),
        lateUnlocked: app.lateUnlocked.includes(date),
      })
    : null;
  const checked = quadrantScore(log);
  const nnDone = items.filter((item) => log?.nonNegotiables[item.id]).length;
  const reminder = useMemo(() => {
    if (!app.data) return null;
    const prior = [...app.data.logs].filter((item) => item.date < today && item.adjust.trim()).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return prior ?? null;
  }, [app.data, today]);
  const [visionOpen, setVisionOpen] = useState(false);

  if (!quarter || !app.week) {
    return (
      <Page>
        <Card>
          <T variant="title">No quarter covers today</T>
          <T color={colors.textSecondary}>Set the dates on the Plan screen. A quarter is {91} days unless you choose another length.</T>
          <Button label="Open the plan" onPress={() => router.push("/plan")} />
        </Card>
      </Page>
    );
  }

  const length = quarterLength(quarter.startDate, quarter.endDate);
  const number = dayNumber(quarter.startDate, today);
  const left = daysLeftInclusive(today, quarter.endDate);
  const missed = (app.statsFor(quarter.id)?.missedDates ?? []).slice(-6);

  const aside = (
    <>
      <WeekCard />
      {missed.length ? (
        <Card>
          <T variant="heading">{missed.length} day{missed.length === 1 ? "" : "s"} still open</T>
          <T color={colors.textSecondary}>Back-fill only reaches days in the open team week. Older weeks stay locked unless you file a late correction.</T>
          {missed.map((missedDate) => (
            <Button key={missedDate} label={`Log ${formatMedium(missedDate)}`} variant="secondary" onPress={() => router.setParams({ day: missedDate })} />
          ))}
        </Card>
      ) : null}
      <Card>
        <T variant="heading">Vision</T>
        <Text style={styles.wrap}>{quarter.vision.trim() || "No vision yet. Write it on the Plan screen."}</Text>
        {quarter.vision.length > 180 ? (
          <Button label={visionOpen ? "Show less" : "Read all"} variant="ghost" onPress={() => setVisionOpen((value) => !value)} />
        ) : null}
        {!visionOpen && quarter.vision.length > 180 ? null : null}
        <Button label="Edit on the Plan screen" variant="secondary" onPress={() => router.push("/plan")} />
      </Card>
      <Card>
        <T variant="heading">Objectives · {plans.filter((plan) => plan.objective.trim()).length}/4 set</T>
        {QUADRANT_IDS.map((quadrant) => {
          const plan = plans.find((item) => item.quadrant === quadrant);
          return (
            <View key={quadrant} style={styles.objective}>
              <QuadrantDot id={quadrant} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.qLabel, { color: quadrants[quadrant].text }]}>{quadrants[quadrant].label}</Text>
                <Text style={styles.wrap}>{plan?.objective.trim() || "No objective set."}</Text>
              </View>
            </View>
          );
        })}
      </Card>
      <Card>
        <T variant="heading">Checkpoints</T>
        <T color={colors.textSecondary}>
          Day 30 is {formatMedium(checkpointDate(quarter.startDate, 30))}. Day 60 is {formatMedium(checkpointDate(quarter.startDate, 60))}. Mark them on the Plan screen once the date has arrived.
        </T>
        <T>
          {app.statsFor(quarter.id)?.checkpoint30Done ?? 0}/4 day-30 marks · {app.statsFor(quarter.id)?.checkpoint60Done ?? 0}/4 day-60 marks
        </T>
      </Card>
    </>
  );

  return (
    <Page aside={aside}>
      <View>
        <T variant="label" color={colors.brand}>
          {quarter.label}
        </T>
        <T variant="title">
          Day {number} of {length} · {left} left
        </T>
        <T color={colors.textSecondary}>
          {quarter.startDate} – {quarter.endDate}. The count includes both dates.
        </T>
      </View>
      {reminder ? (
        <Banner
          title={reminder.date === addDays(today, -1) ? "From yesterday's debrief" : `From ${formatMedium(reminder.date)}`}
          body={reminder.adjust}
        />
      ) : null}
      <Card>
        <View style={styles.switcher}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            disabled={date <= quarter.startDate}
            onPress={() => router.setParams({ day: addDays(date, -1) })}
            style={styles.arrow}
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayTitle}>{formatWeekday(date)}</Text>
            <Text style={styles.meta}>
              Day {dayNumber(quarter.startDate, date)} of {length}
              {date === today ? " · today" : ""}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={date >= today ? "Next day unavailable. You are on today." : "Next day"}
            accessibilityState={{ disabled: date >= today }}
            disabled={date >= today}
            onPress={() => router.setParams({ day: addDays(date, 1) })}
            style={styles.arrow}
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      </Card>
      {app.week ? (
        <Banner
          title={app.week.closed ? "Team week closed" : `Week closes in ${app.week.closesInLabel}`}
          body={
            app.week.teamName
              ? `${app.week.teamName} runs ${app.week.rangeLabel}. Finalize your numbers by ${app.week.finalizeBy}, the day before the ${app.week.callLabel} call. ${app.week.councilNote}`
              : app.week.councilNote
          }
        />
      ) : null}
      {lock?.message ? <Banner title={lock.late ? "Late correction" : "This day is locked"} body={lock.message} tone={lock.late ? "brand" : "danger"} /> : null}
      {lock && !lock.editable && lock.closedWeek ? (
        <Button label="File a late correction" variant="secondary" onPress={() => app.unlockLate(date)} />
      ) : null}
      {log && app.week && logIsLate(log, app.week.weekStartDay, app.week.timeZone) ? <Pill text="Flagged late" color={colors.danger} /> : null}
      <View style={styles.rowBetween}>
        <T variant="heading">Today's tactics</T>
        <Pill text={`${checked} of 4`} />
      </View>
      <View style={desktop ? styles.grid : styles.stack}>
        {QUADRANT_IDS.map((quadrant) => {
          const plan = plans.find((item) => item.quadrant === quadrant);
          return (
            <TacticCard
              key={quadrant}
              quadrant={quadrant}
              tactic={plan?.tactic ?? ""}
              secondary={plan?.secondaryTactic ?? ""}
              checked={Boolean(log?.tactics[quadrant])}
              disabled={!lock?.editable}
              onToggle={() => app.toggleTactic(date, quadrant)}
            />
          );
        })}
      </View>
      <Card>
        <View style={styles.rowBetween}>
          <T variant="heading">Non-negotiables</T>
          <Pill text={`${nnDone}/${items.length || 0}`} />
        </View>
        {items.length === 0 ? <T color={colors.textSecondary}>None yet. Add up to six on the Plan screen.</T> : null}
        {items.map((item) => (
          <CheckRow
            key={item.id}
            checked={Boolean(log?.nonNegotiables[item.id])}
            label={item.label}
            color={colors.brand}
            disabled={!lock?.editable}
            onToggle={() => app.toggleNonNegotiable(date, item.id)}
          />
        ))}
        <Button label="Edit the list on Plan" variant="ghost" onPress={() => router.push("/plan")} />
      </Card>
      <Card>
        <T variant="heading">After Action Review</T>
        <T color={colors.textSecondary}>Writes down as you type. There is no submit button to get stuck on.</T>
        <GrowField label="Sustain — what to keep" value={log?.sustain ?? ""} editable={Boolean(lock?.editable)} onChangeText={(value) => app.updateDebrief(date, "sustain", value)} />
        <GrowField label="Improve — what got in the way" value={log?.improve ?? ""} editable={Boolean(lock?.editable)} onChangeText={(value) => app.updateDebrief(date, "improve", value)} />
        <GrowField label="Adjust — what you'll do differently" value={log?.adjust ?? ""} editable={Boolean(lock?.editable)} onChangeText={(value) => app.updateDebrief(date, "adjust", value)} />
      </Card>
      <T color={colors.textMuted} variant="small">
        {APP_NAME} keeps one checkbox per tactic. The words wrap in full.
      </T>
    </Page>
  );
}

function WeekCard() {
  const { week } = useApp();
  if (!week) return null;
  return (
    <Card>
      <T variant="heading">{week.teamName ? `${week.teamName} week` : "Personal week"}</T>
      <T>{week.rangeLabel}</T>
      <T color={colors.textSecondary}>{week.closed ? "Closed" : `Closes in ${week.closesInLabel}`}. Finalize by {week.finalizeBy}.</T>
    </Card>
  );
}

function TacticCard({
  quadrant,
  tactic,
  secondary,
  checked,
  disabled,
  onToggle,
}: {
  quadrant: QuadrantId;
  tactic: string;
  secondary: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const theme = quadrants[quadrant];
  return (
    <View style={[styles.tactic, { borderColor: theme.color }]}>
      <CheckRow
        checked={checked}
        label={theme.label}
        onToggle={onToggle}
        color={theme.color}
        disabled={disabled}
      />
      <Text style={styles.wrap}>{tactic.trim() || "No daily tactic yet. Add one on the Plan screen."}</Text>
      {secondary.trim() ? (
        <View>
          <Text style={[styles.qLabel, { color: theme.text }]}>Second tactic</Text>
          <Text style={styles.wrap}>{secondary}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: "row", alignItems: "center", gap: 8 },
  arrow: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  arrowText: { color: colors.text, fontSize: 28, fontFamily: fonts.semibold },
  dayTitle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stack: { gap: 12 },
  tactic: { flexGrow: 1, flexBasis: 280, borderWidth: 1, borderRadius: 16, padding: 12, backgroundColor: colors.surface, gap: 8 },
  wrap: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.text },
  qLabel: { fontFamily: fonts.semibold, fontSize: 14, marginBottom: 2 },
  objective: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
});
