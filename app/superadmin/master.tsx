// FILE: app/superadmin/master.tsx  (atau sesuai route kamu)
// ✅ FULL — pakai Inter fontFamily biar konsisten (tanpa ubah logika navigasi/items)

import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const THEME = {
  bg1: "#BFE9FF",
  bg2: "#EAF6FF",
  bg3: "#F7FBFF",
  text: "#0F172A",
  sub: "#64748B",
  border: "#E2E8F0",
  card: "rgba(255,255,255,0.92)",
};

// ✅ font map (pastikan Inter sudah di-load di Root Layout)
const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

export default function MasterMenu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  // ✅ Setting SPP dihapus dari Master (karena sudah disetting saat bikin siswa)
  const items = [
    {
      title: "Tambah / Kelola Unit",
      desc: "Buat unit baru & kelola data unit.",
      icon: "business-outline",
      href: "/superadmin/cabang",
    },
    {
      title: "Tambah / Kelola Admin Unit",
      desc: "Buat user admin untuk tiap unit.",
      icon: "people-outline",
      href: "/superadmin/admin-cabang",
    },
    {
      title: "Setting Hadiah Spin",
      desc: "Atur daftar hadiah & peluang spin.",
      icon: "gift-outline",
      href: "/superadmin/spin",
    },
    {
      title: "Tambah / Kelola Siswa",
      desc: "Tambah siswa berdasarkan unit & kelola daftar siswa.",
      icon: "person-add-outline",
      href: "/superadmin/tambah-siswa",
    },
    {
      title: "Lihat Siswa per Unit",
      desc: "Cek daftar siswa berdasarkan unit.",
      icon: "school-outline",
      href: "/superadmin/siswa",
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            // ✅ biar teks atas gak ketutup (status bar/notch)
            paddingTop: Math.max(insets.top, 14),
            // ✅ biar bawah aman dari tabbar + gesture bar
            paddingBottom: tabH + insets.bottom + 18,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Menu Master</Text>
        <Text style={styles.subtitle}>Kelola fitur utama Superadmin.</Text>

        <View style={styles.card}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.href}
              activeOpacity={0.9}
              onPress={() => router.push(it.href as any)}
              style={styles.rowBtn}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={it.icon as any} size={18} color="#1D4ED8" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{it.title}</Text>
                <Text style={styles.rowDesc}>{it.desc}</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.noteCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#0F172A"
          />
          <Text style={styles.noteText}>ShiningSun — Master</Text>
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 18, // akan dioverride oleh insets.top di atas
    paddingBottom: 26, // akan dioverride oleh tabH + insets.bottom di atas
  },
  title: {
    fontSize: 26,
    fontFamily: F.extrabold,
    color: THEME.text,
  },
  subtitle: {
    marginTop: 8,
    color: THEME.sub,
    fontFamily: F.semibold,
    lineHeight: 20,
    maxWidth: 330,
  },
  card: {
    marginTop: 14,
    backgroundColor: THEME.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 12,
  },
  rowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    marginBottom: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontFamily: F.bold,
    color: THEME.text,
  },
  rowDesc: {
    marginTop: 2,
    color: THEME.sub,
    fontFamily: F.semibold,
    fontSize: 12,
  },
  noteCard: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    borderRadius: 16,
    padding: 12,
  },
  noteText: {
    flex: 1,
    color: "#475569",
    fontFamily: F.bold,
    fontSize: 12,
    lineHeight: 16,
  },
});
