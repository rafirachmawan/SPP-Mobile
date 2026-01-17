// FILE: app/admin/menu.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const F = {
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

const THEME = {
  bg1: "#BFE9FF",
  bg2: "#EAF6FF",
  bg3: "#F7FBFF",
  text: "#0F172A",
  sub: "#64748B",
  border: "#E2E8F0",
  card: "rgba(255,255,255,0.95)",
  primary: "#2563EB",
};

export default function AdminMenu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const menus = [
    {
      title: "Bayar SPP",
      desc: "Cari siswa → invoice → bayar",
      icon: "receipt-outline",
      to: "/admin/bayar",
    },
    {
      title: "Kelola Siswa",
      desc: "Tambah & hapus siswa cabang",
      icon: "person-add-outline",
      to: "/admin/kelola-siswa",
    },
    {
      title: "Mutasi Siswa",
      desc: "Riwayat pembayaran per siswa",
      icon: "people-outline",
      to: "/admin/siswa",
    },
    {
      title: "Riwayat",
      desc: "Riwayat pembayaran",
      icon: "time-outline",
      to: "/admin/riwayat",
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* BACKGROUND SAMA KAYAK DASHBOARD */}
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: 24,
        }}
      >
        {/* HEADER */}
        <Text style={styles.title}>Menu Admin</Text>
        <Text style={styles.subtitle}>Pilih fitur pengelolaan.</Text>

        {/* MENU LIST */}
        <View style={styles.card}>
          {menus.map((m) => (
            <TouchableOpacity
              key={m.title}
              activeOpacity={0.9}
              style={styles.row}
              onPress={() => router.push(m.to as any)}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={m.icon as any}
                  size={18}
                  color={THEME.primary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{m.title}</Text>
                <Text style={styles.rowDesc}>{m.desc}</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: F.extrabold,
    fontSize: 22,
    color: THEME.text,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 12,
    fontFamily: F.semibold,
    color: THEME.sub,
    fontSize: 12,
  },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 12,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    backgroundColor: "#fff",
    marginBottom: 10,
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },

  rowTitle: {
    fontFamily: F.bold,
    fontSize: 13,
    color: THEME.text,
  },
  rowDesc: {
    marginTop: 2,
    fontFamily: F.semibold,
    fontSize: 12,
    color: THEME.sub,
  },
});
