import { Redirect, Stack } from "expo-router";
import { useApp } from "../../src/state/store";
import { colors } from "../../src/theme";

export default function AuthLayout() {
  const { session } = useApp();
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
