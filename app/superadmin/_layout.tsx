import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const THEME = {
  primary: "#0EA5E9",
  muted: "#94A3B8",
  border: "#E2E8F0",
};

export default function SuperadminTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.muted,
        tabBarStyle: {
          borderTopColor: THEME.border,
          height: 62,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontWeight: "800",
          fontSize: 11,
        },
      }}
    >
      {/* DASHBOARD */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      {/* MASTER */}
      <Tabs.Screen
        name="master"
        options={{
          title: "Master",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="apps-outline" size={size} color={color} />
          ),
        }}
      />

      {/* AKUN */}
      <Tabs.Screen
        name="akun"
        options={{
          title: "Akun",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />

      {/* HIDE: semua halaman fitur (dibuka dari Master) */}
      <Tabs.Screen name="cabang" options={{ href: null }} />
      <Tabs.Screen name="admin-cabang" options={{ href: null }} />
      <Tabs.Screen name="spin" options={{ href: null }} />
      <Tabs.Screen name="setting-spp" options={{ href: null }} />
      <Tabs.Screen name="siswa" options={{ href: null }} />

      {/* ✅ INI YANG KURANG: hide tambah-siswa biar gak muncul di footbar */}
      <Tabs.Screen name="tambah-siswa" options={{ href: null }} />
    </Tabs>
  );
}
