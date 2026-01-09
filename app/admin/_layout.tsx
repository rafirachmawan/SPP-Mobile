import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const THEME = {
  primary: "#0EA5E9",
  muted: "#94A3B8",
  border: "#E2E8F0",
};

export default function AdminLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.muted,
        tabBarStyle: {
          height: 62,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopColor: THEME.border,
        },
        tabBarLabelStyle: {
          fontWeight: "800",
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

      {/* 2) Bayar SPP (✅ baru di footbar) */}
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

      {/* 5) Akun (✅ paling kanan) */}
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
