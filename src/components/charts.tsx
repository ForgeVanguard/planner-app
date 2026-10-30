import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from "react-native-svg";
import { checkpointDate } from "../domain/quarters";
import { dayOfWeek, enumerateDays, formatMedium, mondayOffset } from "../domain/dates";
import { quadrantScore } from "../domain/scoring";
import { colors, fonts, quadrants } from "../theme";
import type { DayLog, QuadrantId, Quarter } from "../types";
import { QUADRANT_IDS } from "../types";

const HEAT = [colors.heat0, colors.heat1, colors.heat2, colors.heat3, colors.heat4];

export function Radar({
  values,
  caption,
}: {
  values: Record<QuadrantId, number> | null;
  caption: string;
}) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const radius = 92;
  const point = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 4;
    return [cx + radius * scale * Math.cos(angle), cy + radius * scale * Math.sin(angle)];
  };
  const rings = [0.25, 0.5, 0.75, 1];
  const polygon = values
    ? QUADRANT_IDS.map((quadrant, index) => point(index, Math.max(0.04, (values[quadrant] ?? 0) / 100)).join(",")).join(" ")
    : "";
  return (
    <View accessibilityLabel={caption}>
      <Svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring) => (
          <Polygon
            key={ring}
            points={QUADRANT_IDS.map((_, index) => point(index, ring).join(",")).join(" ")}
            fill="none"
            stroke={colors.line}
            strokeWidth={1}
          />
        ))}
        {QUADRANT_IDS.map((_, index) => {
          const [x, y] = point(index, 1);
          return <Line key={index} x1={cx} y1={cy} x2={x} y2={y} stroke={colors.line} strokeWidth={1} />;
        })}
        {polygon ? <Polygon points={polygon} fill="rgba(228,181,106,0.35)" stroke={colors.brand} strokeWidth={2} /> : null}
        {QUADRANT_IDS.map((quadrant, index) => {
          const [x, y] = point(index, 1.28);
          return (
            <SvgText key={quadrant} x={x} y={y} fill={quadrants[quadrant].text} fontSize={12} textAnchor="middle">
              {quadrants[quadrant].label}
            </SvgText>
          );
        })}
      </Svg>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

export function Heatmap({
  quarter,
  logs,
  today,
  callDay,
  onPick,
}: {
  quarter: Quarter;
  logs: DayLog[];
  today: string;
  callDay: number | null;
  onPick: (date: string) => void;
}) {
  const days = enumerateDays(quarter.startDate, quarter.endDate);
  const byDate = new Map(logs.map((log) => [log.date, log]));
  const lead = mondayOffset(quarter.startDate);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7));
  const day30 = checkpointDate(quarter.startDate, 30);
  const day60 = checkpointDate(quarter.startDate, 60);
  return (
    <View>
      <View style={styles.weekHead}>
        {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekLetter}>
            {label}
          </Text>
        ))}
      </View>
      <View style={{ gap: 6 }}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.grid}>
            {row.map((date, index) => {
              if (!date) return <View key={`empty-${rowIndex}-${index}`} style={styles.cell} />;
              const future = date > today;
              const score = future ? null : quadrantScore(byDate.get(date));
              const color = future ? colors.future : HEAT[score ?? 0];
              const marker = date === day30 || date === day60;
              const call = callDay !== null && dayOfWeek(date) === callDay;
              return (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatMedium(date)}, ${future ? "not yet" : `${score} of 4`}${marker ? ", checkpoint" : ""}`}
                  onPress={() => onPick(date)}
                  style={[styles.cell, { backgroundColor: color }, marker && styles.marker, call && styles.callTick]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Legend swatch={colors.future} label="Ahead" />
        <Legend swatch={colors.heat0} label="0" />
        <Legend swatch={colors.heat2} label="2" />
        <Legend swatch={colors.heat4} label="4" />
        <Text style={styles.caption}>Ring = day 30 or 60. Brass edge = team call day. The grid is the shared quarter calendar.</Text>
      </View>
    </View>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: swatch }]} />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

export function TrendChart({
  labels,
  series,
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
}) {
  if (labels.length === 0) return <Text style={styles.caption}>Close a quarter and the trend will draw itself.</Text>;
  const width = 640;
  const height = 220;
  const pad = 28;
  const max = Math.max(10, ...series.flatMap((item) => item.values));
  const x = (index: number) => pad + (labels.length === 1 ? (width - pad * 2) / 2 : (index * (width - pad * 2)) / (labels.length - 1));
  const y = (value: number) => height - pad - (value / max) * (height - pad * 2);
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.5, 1].map((step) => (
        <Line key={step} x1={pad} x2={width - pad} y1={y(max * step)} y2={y(max * step)} stroke={colors.line} strokeWidth={1} />
      ))}
      {series.map((item) => (
        <Polyline
          key={item.name}
          points={item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
          fill="none"
          stroke={item.color}
          strokeWidth={3}
        />
      ))}
      {series.map((item) =>
        item.values.map((value, index) => <Circle key={`${item.name}-${index}`} cx={x(index)} cy={y(value)} r={4} fill={item.color} />),
      )}
      {labels.map((label, index) => (
        <SvgText key={label} x={x(index)} y={height - 6} fill={colors.textSecondary} fontSize={12} textAnchor="middle">
          {label}
        </SvgText>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  weekHead: { flexDirection: "row", gap: 6, marginBottom: 6 },
  weekLetter: { flex: 1, textAlign: "center", color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 13 },
  grid: { flexDirection: "row", gap: 6 },
  cell: { flex: 1, height: 32, borderRadius: 6 },
  marker: { borderWidth: 2, borderColor: colors.text },
  callTick: { borderBottomWidth: 3, borderBottomColor: colors.brand },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 10 },
  legendItem: { flexDirection: "row", gap: 6, alignItems: "center" },
  swatch: { width: 14, height: 14, borderRadius: 3 },
});
