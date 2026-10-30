import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Link } from "expo-router";
import { Banner, Button, Card, GrowField, T } from "../components/ui";
import { APP_NAME, APP_TAGLINE, DEMO_EMAIL, DEMO_PASSWORD } from "../config";
import { useApp } from "../state/store";
import { colors, fonts } from "../theme";

export function SignInScreen() {
  const app = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthFrame>
      <T variant="title">Sign in</T>
      <GrowField label="Email" value={email} minHeight={64} onChangeText={setEmail} />
      <GrowField label="Password" value={password} minHeight={64} onChangeText={setPassword} />
      {error ? <Banner title="Couldn't sign in" body={error} tone="danger" /> : null}
      <Button
        label={busy ? "Signing in…" : "Sign in"}
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void app.signIn(email, password).then((message) => {
            setError(message);
            setBusy(false);
          });
        }}
      />
      <Link href="/forgot-password" style={styles.link}>Forgot password</Link>
      <Link href="/sign-up" style={styles.link}>Create an account</Link>
      {app.mode === "demo" ? (
        <Button label={`Use the demo workspace (${DEMO_EMAIL} / ${DEMO_PASSWORD})`} variant="secondary" onPress={() => void app.enterDemo()} />
      ) : null}
    </AuthFrame>
  );
}

export function SignUpScreen() {
  const app = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthFrame>
      <T variant="title">Create an account</T>
      <GrowField label="Name" value={name} minHeight={64} onChangeText={setName} />
      <GrowField label="Email" value={email} minHeight={64} onChangeText={setEmail} />
      <GrowField label="Password" hint="At least 8 characters." value={password} minHeight={64} onChangeText={setPassword} />
      {error ? <Banner title="Couldn't create the account" body={error} tone="danger" /> : null}
      {info ? <Banner title="Check your email" body={info} /> : null}
      <Button
        label={busy ? "Creating…" : "Create account"}
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void app.signUp(name, email, password).then((message) => {
            if (message && app.mode === "supabase") setInfo(message);
            else setError(message);
            setBusy(false);
          });
        }}
      />
      <Link href="/sign-in" style={styles.link}>Already have an account</Link>
    </AuthFrame>
  );
}

export function ForgotPasswordScreen() {
  const app = useApp();
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthFrame>
      <T variant="title">Reset password</T>
      <GrowField label="Email" value={email} minHeight={64} onChangeText={setEmail} />
      {info ? <Banner title="Reset" body={info} /> : null}
      <Button
        label={busy ? "Sending…" : "Send reset link"}
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void app.requestReset(email).then((message) => {
            setInfo(message);
            setBusy(false);
          });
        }}
      />
      <Link href="/sign-in" style={styles.link}>Back to sign in</Link>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <View style={styles.story}>
        <T variant="display">{APP_NAME}</T>
        <T color={colors.textSecondary}>{APP_TAGLINE}</T>
        <T color={colors.textSecondary}>Four quadrants. One quarter. A record you can still read years from now.</T>
      </View>
      <Card style={styles.form}>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, gap: 24, justifyContent: "center", flexDirection: "row", flexWrap: "wrap" },
  story: { flexGrow: 1, flexBasis: 320, maxWidth: 520, gap: 12, justifyContent: "center" },
  form: { flexGrow: 1, flexBasis: 320, maxWidth: 480, gap: 12 },
  link: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 16, paddingVertical: 8 },
});
