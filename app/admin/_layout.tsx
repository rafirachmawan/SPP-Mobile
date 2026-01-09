import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function AdminTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0EA5E9",
        tabBarInactiveTintColor: "#64748B",
        tabBarLabelStyle: { fontWeight: "900", fontSize: 12 },
        tabBarStyle: {
          height: 66,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: "rgba(226,232,240,0.95)",
          backgroundColor: "rgba(255,255,255,0.96)",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Bayar SPP",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash-outline" size={size ?? 22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="siswa"
        options={{
          title: "Siswa",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size ?? 22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="akun"
        options={{
          title: "Akun",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-circle-outline"
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
