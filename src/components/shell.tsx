import { Ionicons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_NAME, COUNCIL_NAME } from "../config";
import { colors, fonts } from "../theme";
import { useApp } from "../state/store";
import { useBreakpoint } from "./ui";

const PRIMARY = [
  { href: "/", label: "Today", icon: "sunny-outline" as const },
  { href: "/plan", label: "Plan", icon: "map-outline" as const },
  { href: "/snapshot", label: "Snapshot", icon: "pulse-outline" as const },
  { href: "/review", label: "Review", icon: "flag-outline" as const },
  { href: "/standings", label: "Standings", icon: "podium-outline" as const },
];

const SECONDARY = [
  { href: "/archive", label: "Archive", icon: "library-outline" as const },
  { href: "/team", label: "Team", icon: "people-outline" as const },
  { href: "/profile", label: "Profile", icon: "person-outline" as const },
  { href: "/help", label: "Help", icon: "help-circle-outline" as const },
];

function active(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { desktop } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { syncLabel, pendingCount, online, mode } = useApp();
  const items = [...PRIMARY, ...SECONDARY];
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.frame}>
        {desktop ? (
          <View style={styles.sidebar} accessibilityRole="menu">
            <Text style={styles.wordmark}>{APP_NAME}</Text>
            <Text style={styles.council}>{COUNCIL_NAME}</Text>
            {items.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} selected={active(pathname, item.href)} />
            ))}
          </View>
        ) : null}
        <View style={styles.main}>
          <View style={styles.topbar}>
            {desktop ? <View style={{ flex: 1 }} /> : <Text style={styles.wordmarkSmall}>{APP_NAME}</Text>}
            <View style={styles.sync} accessibilityRole="text" accessibilityLabel={syncLabel}>
              <View style={[styles.dot, { backgroundColor: online ? colors.ok : colors.danger }]} />
              <Text style={styles.syncText}>
                {mode === "demo" ? "Demo · " : ""}
                {syncLabel}
                {pendingCount > 0 ? ` · ${pendingCount} waiting` : ""}
              </Text>
            </View>
            {!desktop ? (
              <View style={styles.topLinks}>
                <TopIcon href="/archive" label="Archive" icon="library-outline" />
                <TopIcon href="/team" label="Team" icon="people-outline" />
                <TopIcon href="/profile" label="Profile" icon="person-outline" />
                <TopIcon href="/help" label="Help" icon="help-circle-outline" />
              </View>
            ) : null}
          </View>
          <View style={styles.content}>{children}</View>
          {!desktop ? (
            <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              {PRIMARY.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} selected={active(pathname, item.href)} compact />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function NavLink({
  href,
  label,
  icon,
  selected,
  compact,
}: {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  compact?: boolean;
}) {
  const itemStyle = StyleSheet.flatten([styles.navItem, compact ? styles.navCompact : null, selected ? styles.navSelected : null]);
  const labelStyle = StyleSheet.flatten([styles.navLabel, selected ? styles.navLabelOn : null, compact ? styles.navLabelCompact : null]);
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={itemStyle}
      >
        <Ionicons name={icon} size={compact ? 20 : 18} color={selected ? colors.brandInk : colors.text} />
        <Text style={labelStyle}>{label}</Text>
      </Pressable>
    </Link>
  );
}

function TopIcon({ href, label, icon }: { href: string; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <Link href={href as never} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={label} style={styles.topIcon}>
        <Ionicons name={icon} size={22} color={colors.text} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  frame: { flex: 1, flexDirection: "row" },
  sidebar: { width: 232, borderRightWidth: 1, borderRightColor: colors.line, padding: 16, gap: 6, backgroundColor: colors.bgElevated },
  wordmark: { fontFamily: fonts.display, fontSize: 26, color: colors.text, marginBottom: 2 },
  wordmarkSmall: { fontFamily: fonts.display, fontSize: 20, color: colors.text, flex: 1 },
  council: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  main: { flex: 1, minWidth: 0 },
  topbar: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  content: { flex: 1 },
  sync: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  syncText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  topLinks: { flexDirection: "row" },
  topIcon: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bgElevated },
  navItem: { minHeight: 44, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  navCompact: { flex: 1, flexDirection: "column", justifyContent: "center", gap: 2, paddingHorizontal: 2 },
  navSelected: { backgroundColor: colors.brand },
  navLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  navLabelOn: { color: colors.brandInk, fontFamily: fonts.semibold },
  navLabelCompact: { fontSize: 11, lineHeight: 14 },
});
