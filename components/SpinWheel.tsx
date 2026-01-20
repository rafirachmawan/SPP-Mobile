import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

const SIZE = 220;
const R = SIZE / 2;

const COLORS = [
  "#60A5FA",
  "#34D399",
  "#FBBF24",
  "#F87171",
  "#A78BFA",
  "#22D3EE",
  "#FB923C",
  "#4ADE80",
];

export default function SpinWheel({ items }: { items: string[] }) {
  const slice = 360 / items.length;

  function polarToCartesian(cx: number, cy: number, r: number, a: number) {
    const rad = ((a - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function arcPath(start: number, end: number) {
    const s = polarToCartesian(R, R, R, end);
    const e = polarToCartesian(R, R, R, start);
    return `
      M ${R} ${R}
      L ${s.x} ${s.y}
      A ${R} ${R} 0 ${end - start > 180 ? 1 : 0} 0 ${e.x} ${e.y}
      Z
    `;
  }

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <G>
          {items.map((label, i) => {
            const start = i * slice;
            const end = start + slice;
            return (
              <Path
                key={i}
                d={arcPath(start, end)}
                fill={COLORS[i % COLORS.length]}
              />
            );
          })}
          <Circle cx={R} cy={R} r={30} fill="#fff" />
        </G>
      </Svg>

      <View style={styles.center}>
        <Text style={styles.centerText}>🎁</Text>
      </View>

      <View style={styles.pointer} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: {
    color: "#fff",
    fontSize: 22,
  },
  pointer: {
    position: "absolute",
    top: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#EF4444",
  },
});
