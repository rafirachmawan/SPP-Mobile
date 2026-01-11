import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const THEME = {
  bg1: "#BFE9FF",
  bg2: "#EAF6FF",
  bg3: "#F7FBFF",
  text: "#0F172A",
  sub: "#64748B",
  border: "#E2E8F0",
  card: "rgba(255,255,255,0.92)",
  primary: "#0EA5E9",
};

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const stats = [
    { label: "Total Siswa", value: "120", icon: "school-outline" },
    { label: "Bayar Bulan Ini", value: "45", icon: "cash-outline" },
    { label: "Spin Dipakai", value: "12", icon: "gift-outline" },
    { label: "Info", value: "UI dulu", icon: "information-circle-outline" },
  ];

  const actions = [
    {
      title: "Bayar SPP",
      desc: "Cari siswa → pilih → Bayar atau Spin.",
      icon: "receipt-outline",
      to: "/admin/bayar",
    },
    {
      title: "Siswa",
      desc: "Daftar siswa cabang ini + mutasi pembayaran.",
      icon: "people-outline",
      to: "/admin/siswa",
    },
    {
      title: "Riwayat",
      desc: "Riwayat pembayaran yang sudah tercatat.",
      icon: "time-outline",
      to: "/admin/riwayat",
    },
  ];

  const topPad = Math.max(insets.top + 8, 18); // ✅ biar tidak ketutup status bar/notch

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>Shining Sun 🎈</Text>
            <Text style={styles.title}>Dashboard Admin</Text>
            <Text style={styles.subtitle}>
              Kelola pembayaran SPP cabang ini. Mulai dari Bayar SPP atau cek
              siswa.
            </Text>
          </View>

          <View style={styles.pill}>
            <Text style={styles.pillText}>Cabang</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name={s.icon as any} size={18} color="#1D4ED8" />
              </View>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Menu Utama</Text>
          <Text style={styles.cardSub}>Pilih fitur untuk membuka konten.</Text>

          {actions.map((a) => (
            <TouchableOpacity
              key={a.title}
              activeOpacity={0.9}
              onPress={() => router.push(a.to as any)}
              style={styles.rowBtn}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={a.icon as any} size={18} color="#1D4ED8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{a.title}</Text>
                <Text style={styles.rowDesc}>{a.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Note */}
        <View style={styles.noteCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#0F172A"
          />
          <Text style={styles.noteText}>
            Ini masih UI dummy. Nanti data cabang, siswa, dan pembayaran
            disambungkan ke Firebase.
          </Text>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 18, // ✅ default tetap ada, tapi akan dioverride oleh insets di atas
    paddingBottom: 26,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  brand: { color: "#2563EB", fontWeight: "900" },
  title: { marginTop: 6, fontSize: 26, fontWeight: "900", color: THEME.text },
  subtitle: {
    marginTop: 8,
    color: THEME.sub,
    fontWeight: "700",
    lineHeight: 20,
    maxWidth: 280,
  },
  pill: {
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { color: "#1E40AF", fontWeight: "900", fontSize: 12 },

  statsGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 12,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statLabel: { color: THEME.sub, fontWeight: "800", fontSize: 12 },
  statValue: {
    marginTop: 4,
    color: THEME.text,
    fontWeight: "900",
    fontSize: 20,
  },

  card: {
    marginTop: 14,
    backgroundColor: THEME.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", color: THEME.text },
  cardSub: { marginTop: 6, color: THEME.sub, fontWeight: "700", fontSize: 12 },

  rowBtn: {
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontWeight: "900", color: THEME.text },
  rowDesc: { marginTop: 2, color: THEME.sub, fontWeight: "700", fontSize: 12 },

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
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
  },
});
