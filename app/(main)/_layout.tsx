import { Redirect, Slot, usePathname } from "expo-router";
import { AppShell } from "../../src/components/shell";
import { useApp } from "../../src/state/store";

export default function MainLayout() {
  const { session, data } = useApp();
  const pathname = usePathname();
  if (!session) return <Redirect href="/sign-in" />;
  if (data && !data.profile.onboarded && pathname !== "/onboarding") return <Redirect href="/onboarding" />;
  if (pathname === "/onboarding") return <Slot />;
  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
