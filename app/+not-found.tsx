import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { APP_NAME } from "../src/config";
import { colors, fonts, quadrants } from "../src/theme";

export default function NotFound() {
  return (
    <View style={styles.screen}>
      <View style={styles.dots}>
        {Object.values(quadrants).map((quadrant) => (
          <View key={quadrant.label} style={[styles.dot, { backgroundColor: quadrant.color }]} />
        ))}
      </View>
      <Text style={styles.title} accessibilityRole="header">This page isn't on the map.</Text>
      <Text style={styles.body}>{APP_NAME} doesn't have a screen at this address.</Text>
      <Link href="/" style={styles.link}>Back to today</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: "flex-start", justifyContent: "center", padding: 32, gap: 12 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  title: { fontFamily: fonts.display, fontSize: 36, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 18, lineHeight: 28, color: colors.textSecondary, maxWidth: 520 },
  link: { fontFamily: fonts.semibold, fontSize: 18, color: colors.brand, paddingVertical: 12 },
});
