// FILE: app/admin/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const THEME = {
  primary: "#0EA5E9",
  muted: "#94A3B8",
  border: "#E2E8F0",
};

export default function AdminLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.muted,
        tabBarStyle: {
          borderTopColor: THEME.border,
          height: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 10 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontWeight: Platform.OS === "ios" ? "800" : "900",
          fontSize: 11,
        },
      }}
    >
      {/* ================= TAB YANG DITAMPILKAN ================= */}

      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="menu"
        options={{
          title: "Admin",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="apps-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="akun"
        options={{
          title: "Akun",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ================= TAB DISEMBUNYIKAN ================= */}

      <Tabs.Screen name="bayar" options={{ href: null }} />
      <Tabs.Screen name="siswa" options={{ href: null }} />
      <Tabs.Screen name="riwayat" options={{ href: null }} />
      <Tabs.Screen name="kelola-siswa" options={{ href: null }} />
    </Tabs>
  );
}
