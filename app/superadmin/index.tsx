import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function SuperadminDashboard() {
  const router = useRouter();

  // ✅ dummy ringkasan (nanti dari database)
  const summary = useMemo(
    () => ({
      cabang: 5,
      admin: 7,
      siswa: 512,
      bayarBulanIni: 126,
      spinDipakai: 34,
    }),
    []
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brand}>SPP Mobile</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Superadmin</Text>
          </View>
        </View>

        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>
          Kelola cabang, admin cabang, aturan spin, dan SPP global/per siswa.
        </Text>

        {/* Summary cards */}
        <View style={styles.grid}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Total Cabang</Text>
            <Text style={styles.miniValue}>{summary.cabang}</Text>
          </View>

          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Admin Cabang</Text>
            <Text style={styles.miniValue}>{summary.admin}</Text>
          </View>

          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Total Siswa</Text>
            <Text style={styles.miniValue}>{summary.siswa}</Text>
          </View>

          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Bayar Bulan Ini</Text>
            <Text style={styles.miniValue}>{summary.bayarBulanIni}</Text>
          </View>

          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Spin Dipakai</Text>
            <Text style={styles.miniValue}>{summary.spinDipakai}</Text>
          </View>

          <View style={[styles.miniCard, styles.miniCardAlt]}>
            <Text style={styles.miniLabel}>Info</Text>
            <Text style={styles.miniSmall}>UI dulu, database nanti.</Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aksi Cepat</Text>
          <Text style={styles.cardSub}>
            Shortcut untuk mengatur fitur utama.
          </Text>

          <View style={{ gap: 10, marginTop: 12 }}>
            <Action
              icon="business-outline"
              label="Tambah / Kelola Cabang"
              onPress={() => router.push("./superadmin/cabang")}
            />
            <Action
              icon="people-outline"
              label="Tambah / Kelola Admin Cabang"
              onPress={() => router.push("./superadmin/admin-cabang")}
            />
            <Action
              icon="gift-outline"
              label="Setting Hadiah Spin"
              onPress={() => router.push("/superadmin/spin")}
            />
            <Action
              icon="settings-outline"
              label="Setting SPP (Global & Per Siswa)"
              onPress={() => router.push("/superadmin/setting-spp")}
            />
            <Action
              icon="school-outline"
              label="Lihat Siswa per Cabang"
              onPress={() => router.push("/superadmin/siswa")}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.secondaryBtn}
            onPress={() => router.push("/superadmin/master")}
          >
            <Ionicons name="apps-outline" size={18} color="#0F172A" />
            <Text style={styles.secondaryText}>Buka Menu Master</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.noteCard}
          onPress={() =>
            Alert.alert(
              "Catatan",
              "Selanjutnya kita sambungkan Firebase + Spreadsheet realtime."
            )
          }
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#0F172A"
          />
          <Text style={styles.noteText}>
            Semua data masih dummy. Fokus UI dulu, database menyusul.
          </Text>
        </TouchableOpacity>

        <View style={{ height: 10 }} />
      </ScrollView>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.actionItem}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={18} color="#1E40AF" />
      </View>
      <Text style={styles.actionText}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, gap: 12 },

  header: {
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontWeight: "900", color: "#1D4ED8", letterSpacing: 0.3 },
  chip: {
    backgroundColor: "rgba(219,234,254,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
  },
  chipText: { color: "#1E40AF", fontWeight: "900", fontSize: 12 },

  title: { fontSize: 26, fontWeight: "900", color: "#0F172A" },
  subtitle: {
    color: "#64748B",
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 2,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  miniCard: {
    width: "48.4%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  miniCardAlt: { backgroundColor: "rgba(255,255,255,0.75)" },
  miniLabel: { color: "#64748B", fontWeight: "800" },
  miniValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
  },
  miniSmall: { marginTop: 8, fontWeight: "800", color: "#0F172A" },

  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  cardSub: {
    marginTop: 6,
    color: "#64748B",
    fontWeight: "700",
    lineHeight: 18,
  },

  actionItem: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1, fontWeight: "900", color: "#0F172A" },

  secondaryBtn: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryText: { color: "#0F172A", fontWeight: "900" },

  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  noteText: { flex: 1, color: "#64748B", fontWeight: "800" },
});
