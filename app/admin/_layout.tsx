import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

const THEME = {
  primary: "#0EA5E9",
  muted: "#94A3B8",
  border: "#E2E8F0",
};

export default function AdminLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.muted,

        // ✅ aman di Android gesture/home bar + iOS
        tabBarStyle: {
          borderTopColor: THEME.border,
          height: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 10 + insets.bottom,
        },

        // ✅ samakan rasa font (lebih mirip style screen lain)
        tabBarLabelStyle: {
          fontWeight: Platform.OS === "ios" ? "800" : "900",
          fontSize: 11,
        },
      }}
    >
      {/* 1) Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 2) Bayar SPP */}
      <Tabs.Screen
        name="bayar"
        options={{
          title: "Bayar SPP",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 3) Siswa */}
      <Tabs.Screen
        name="siswa"
        options={{
          title: "Siswa",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 4) Riwayat */}
      <Tabs.Screen
        name="riwayat"
        options={{
          title: "Riwayat",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 5) Akun (paling kanan) */}
      <Tabs.Screen
        name="akun"
        options={{
          title: "Akun",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
