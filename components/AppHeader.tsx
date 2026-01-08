import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "./theme";

export default function AppHeader({
  title,
  subtitle,
  chip,
}: {
  title: string;
  subtitle?: string;
  chip?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>SPP Mobile</Text>
        {chip ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{chip}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  brand: {
    fontWeight: "900",
    color: theme.primaryDark,
    letterSpacing: 0.4,
  },
  chip: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: {
    color: "#1E40AF",
    fontWeight: "800",
    fontSize: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: theme.text,
    letterSpacing: 0.2,
  },
  sub: {
    marginTop: 6,
    color: theme.sub,
    lineHeight: 20,
  },
});
