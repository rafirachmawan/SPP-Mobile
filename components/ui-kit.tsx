import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from "react-native";
import { theme } from "./theme";

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function P({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.p, style]}>{children}</Text>;
}

export function Badge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const bg =
    tone === "success"
      ? "#DCFCE7"
      : tone === "warning"
      ? "#FEF3C7"
      : tone === "danger"
      ? "#FEE2E2"
      : tone === "info"
      ? "#DBEAFE"
      : "#E2E8F0";

  const fg =
    tone === "success"
      ? "#166534"
      : tone === "warning"
      ? "#92400E"
      : tone === "danger"
      ? "#991B1B"
      : tone === "info"
      ? "#1E40AF"
      : "#0F172A";

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  color = theme.primary,
  disabled,
  loading,
}: {
  title: string;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={isDisabled}
      style={[
        styles.btn,
        { backgroundColor: color },
        isDisabled ? { opacity: 0.6 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text style={styles.btnText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function GhostButton({
  title,
  onPress,
  color = theme.text,
}: {
  title: string;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={styles.ghostBtn}
    >
      <Text style={[styles.ghostText, { color }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  h1: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: 0.2,
  },
  p: {
    fontSize: 14,
    color: theme.sub,
    lineHeight: 20,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontWeight: "700",
    fontSize: 12,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },
  ghostBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
  },
  ghostText: {
    fontWeight: "800",
    fontSize: 14,
  },
});
