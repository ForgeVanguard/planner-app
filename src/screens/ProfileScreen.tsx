import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Banner, Button, Card, GrowField, Page, Segmented, T } from "../components/ui";
import { APP_NAME } from "../config";
import { toCSV, toJSON, toMarkdown } from "../domain/export-data";
import { downloadText } from "../lib/share";
import { useApp } from "../state/store";
import { colors } from "../theme";
import type { FeedbackKind, Visibility } from "../types";

export function ProfileScreen() {
  const app = useApp();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [feedback, setFeedback] = useState("");
  const profile = app.data?.profile;
  if (!profile || !app.data) return null;
  return (
    <Page>
      <T variant="title">Profile</T>
      {app.mode === "demo" ? (
        <Banner title="Demo on this device" body="Nothing here is sent to a server until you add Supabase keys. Changes stay in local storage and in the offline queue." />
      ) : (
        <Banner title="Connected" body="Your record syncs to Supabase when you're online. Offline edits stay queued." tone="ok" />
      )}
      <Card>
        <GrowField label="Name" value={profile.name} minHeight={64} onChangeText={(value) => app.updateProfile("name", value)} />
        <GrowField label="Email" value={profile.email} minHeight={64} onChangeText={(value) => app.updateProfile("email", value)} />
        <T>Team: {app.myTeam?.name ?? "None"}</T>
        <Button label="Change team" variant="secondary" onPress={() => router.push("/team")} />
        <T variant="heading">Who can see your plan</T>
        <Segmented
          label="Plan visibility"
          value={profile.visibility}
          onChange={(id) => app.updateProfile("visibility", id as Visibility)}
          options={[
            { id: "everyone", label: "Everyone" },
            { id: "team", label: "My team" },
            { id: "private", label: "Only me" },
          ]}
        />
      </Card>
      <Card>
        <T variant="heading">Reminders</T>
        <T color={colors.textSecondary}>On iOS and Android these are local notifications: morning tactics and an evening debrief. Web keeps the times but does not schedule them.</T>
        <Segmented
          label="Reminders"
          value={profile.remindersEnabled ? "on" : "off"}
          onChange={(id) => app.updateProfile("remindersEnabled", id === "on")}
          options={[
            { id: "on", label: "On" },
            { id: "off", label: "Off" },
          ]}
        />
        <GrowField label="Morning reminder" hint="HH:MM" value={profile.morningReminder} minHeight={64} onChangeText={(value) => app.updateProfile("morningReminder", value)} />
        <GrowField label="Evening debrief" hint="HH:MM" value={profile.eveningReminder} minHeight={64} onChangeText={(value) => app.updateProfile("eveningReminder", value)} />
      </Card>
      <Card>
        <T variant="heading">Connection</T>
        <T color={colors.textSecondary}>{app.syncLabel}. {app.pendingCount} change{app.pendingCount === 1 ? "" : "s"} waiting.</T>
        <Segmented
          label="Simulate offline"
          value={app.forceOffline ? "off" : "on"}
          onChange={(id) => app.setForceOffline(id === "off")}
          options={[
            { id: "on", label: "Online" },
            { id: "off", label: "Offline" },
          ]}
        />
      </Card>
      <Card>
        <T variant="heading">Export the whole record</T>
        <T color={colors.textSecondary}>JSON, CSV, and Markdown include every quarter, not just the one you're in.</T>
        <View style={styles.row}>
          <Button label="JSON" variant="secondary" onPress={() => void downloadText(`${APP_NAME.replace(/\s+/g, "-").toLowerCase()}.json`, toJSON(app.data!, new Date().toISOString()), "application/json")} />
          <Button label="CSV" variant="secondary" onPress={() => void downloadText("planner-app.csv", toCSV(app.data!), "text/csv")} />
          <Button label="Markdown" variant="secondary" onPress={() => void downloadText("planner-app.md", toMarkdown(app.data!), "text/markdown")} />
        </View>
      </Card>
      <Card>
        <T variant="heading">Feedback</T>
        <Segmented
          label="Feedback kind"
          value={kind}
          onChange={(id) => setKind(id as FeedbackKind)}
          options={[
            { id: "idea", label: "Idea" },
            { id: "bug", label: "Bug" },
            { id: "other", label: "Other" },
          ]}
        />
        <GrowField label="Note" value={feedback} onChangeText={setFeedback} />
        <Button
          label="Save feedback"
          onPress={() => {
            app.addFeedback(kind, feedback);
            setFeedback("");
            setMessage("Saved on this device.");
          }}
        />
      </Card>
      <Card>
        <T variant="heading">Password</T>
        <GrowField label="Current password" value={current} minHeight={64} onChangeText={setCurrent} />
        <GrowField label="New password" value={next} minHeight={64} onChangeText={setNext} />
        <Button
          label="Update password"
          variant="secondary"
          onPress={() => {
            void app.updatePassword(current, next).then((error) => {
              setMessage(error ?? "Password updated.");
              if (!error) {
                setCurrent("");
                setNext("");
              }
            });
          }}
        />
      </Card>
      {message ? <Banner title="Note" body={message} /> : null}
      <Button label="Replay the introduction" variant="secondary" onPress={() => { app.updateProfile("onboarded", false); router.push("/onboarding"); }} />
      <Button label="Sign out" variant="danger" onPress={() => void app.signOut()} />
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
