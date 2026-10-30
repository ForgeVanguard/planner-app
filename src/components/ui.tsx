import { useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, fonts, MIN_FIELD, MIN_FIELD_SHORT, quadrants, space } from "../theme";
import type { QuadrantId } from "../types";

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  return { width, height, desktop: width >= 1080, tablet: width >= 760 };
}

export function T({
  children,
  variant = "body",
  color = colors.text,
  style,
}: {
  children: ReactNode;
  variant?: "display" | "title" | "heading" | "body" | "small" | "label";
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text accessibilityRole={variant === "display" || variant === "title" || variant === "heading" ? "header" : "text"} style={[styles[variant], { color }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, variant === "primary" ? styles.primaryText : styles.secondaryText, variant === "danger" && { color: colors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GrowField({
  label,
  value,
  onChangeText,
  hint,
  placeholder,
  minHeight = MIN_FIELD,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  hint?: string;
  placeholder?: string;
  minHeight?: number;
  editable?: boolean;
}) {
  const estimate = Math.max(minHeight, value.split("\n").length * 26 + Math.ceil(value.length / 42) * 22 + 36);
  const [height, setHeight] = useState(estimate);
  const shown = Math.max(minHeight, height, estimate);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        multiline
        editable={editable}
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#8E99A8"
        onChangeText={onChangeText}
        onContentSizeChange={(event) => {
          const measured = Math.ceil(event.nativeEvent.contentSize.height);
          if (!Number.isFinite(measured) || measured <= 0) return;
          const next = Math.max(minHeight, measured);
          setHeight((current) => (Math.abs(next - current) < 8 ? current : next));
        }}
        style={StyleSheet.flatten([styles.input, { minHeight, height: shown }, !editable ? styles.readOnly : null])}
        textAlignVertical="top"
      />
    </View>
  );
}

export function ShortField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  editable = true,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  editable?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
}) {
  return (
    <GrowField
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      hint={hint}
      editable={editable}
      minHeight={keyboardType === "number-pad" || (value.length < 48 && !value.includes("\n")) ? MIN_FIELD_SHORT : MIN_FIELD}
    />
  );
}

export function CheckRow({
  checked,
  label,
  detail,
  onToggle,
  color,
  disabled,
}: {
  checked: boolean;
  label: string;
  detail?: string;
  onToggle: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [styles.checkRow, pressed && !disabled && styles.pressed]}
    >
      <View style={[styles.box, { borderColor: color }, checked && { backgroundColor: color }]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        {detail ? <Text style={styles.wrap}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Banner({ title, body, tone = "brand" }: { title: string; body: string; tone?: "brand" | "danger" | "ok" }) {
  const border = tone === "danger" ? colors.danger : tone === "ok" ? colors.ok : colors.brand;
  return (
    <View style={[styles.banner, { borderLeftColor: border }]}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.wrap}>{body}</Text>
    </View>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.segment}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={[styles.segmentItem, selected && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pill({ text, color = colors.brand }: { text: string; color?: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export function QuadrantDot({ id }: { id: QuadrantId }) {
  return <View style={[styles.dot, { backgroundColor: quadrants[id].color }]} accessibilityLabel={quadrants[id].label} />;
}

export function Page({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const { desktop } = useBreakpoint();
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {desktop && aside ? (
        <View style={styles.split}>
          <View style={styles.mainCol}>{children}</View>
          <View style={styles.sideCol}>{aside}</View>
        </View>
      ) : (
        <View style={styles.stack}>
          {children}
          {aside}
        </View>
      )}
    </ScrollView>
  );
}

export function SkeletonBlock({ height = 18, width = "100%" }: { height?: number; width?: number | `${number}%` }) {
  return <View style={[styles.skeleton, { height, width }]} accessibilityLabel="Loading" />;
}

export function BootScreen() {
  return (
    <View style={styles.boot}>
      <SkeletonBlock height={28} width="46%" />
      <SkeletonBlock height={120} />
      <SkeletonBlock height={88} />
      <SkeletonBlock height={88} />
      <SkeletonBlock height={88} />
    </View>
  );
}

export function iconButtonStyle(pressed: boolean): PressableProps["style"] {
  return [styles.iconButton, pressed && styles.pressed];
}

const styles = StyleSheet.create({
  display: { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 46 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26 },
  small: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.6, textTransform: "uppercase" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: space.md,
    gap: 10,
  },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
  primaryText: { color: colors.brandInk },
  secondaryText: { color: colors.text },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
  },
  readOnly: { backgroundColor: colors.bgElevated },
  checkRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", minHeight: 48, paddingVertical: 6 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2 },
  tick: { color: colors.brandInk, fontFamily: fonts.bold, fontSize: 16 },
  checkLabel: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 24, color: colors.text, flexShrink: 1 },
  wrap: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.textSecondary, flexShrink: 1 },
  banner: { backgroundColor: colors.surface, borderRadius: 16, borderLeftWidth: 4, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.line },
  bannerTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  segment: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segmentItem: { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  segmentOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  segmentText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  segmentTextOn: { color: colors.brandInk },
  pill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: fonts.semibold, fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  page: { padding: 16, paddingBottom: 48, gap: 16 },
  split: { flexDirection: "row", alignItems: "flex-start", gap: 20 },
  mainCol: { flex: 1.4, gap: 16, minWidth: 0 },
  sideCol: { flex: 0.9, gap: 16, minWidth: 280 },
  stack: { gap: 16, width: "100%" },
  skeleton: { backgroundColor: colors.surface2, borderRadius: 12 },
  boot: { flex: 1, backgroundColor: colors.bg, padding: 24, gap: 14, justifyContent: "center" },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
});

export const uiColors = colors;
export const quadrantTheme = quadrants;
