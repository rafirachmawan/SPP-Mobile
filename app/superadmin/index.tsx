// FILE: app/superadmin/index.tsx
// ✅ FULL VERSION — UI lebih compact (tidak kebesaran), logika realtime tetap sama

import React, { useEffect, useMemo, useState } from "react";
import {
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// ✅ Firebase
import { db } from "../../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

// ✅ font map (pastikan kamu sudah load Inter di Root layout / app entry)
const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function rupiah(n: number) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

export default function SuperadminDashboard() {
  const router = useRouter();

  const tabH = useBottomTabBarHeight(); // ✅ tinggi footbar dinamis
  const insets = useSafeAreaInsets(); // ✅ aman untuk gesture/home bar Android

  const mkNow = useMemo(() => monthKeyOf(new Date()), []);

  // ✅ realtime summary (bukan dummy)
  const [summary, setSummary] = useState({
    cabang: 0,
    admin: 0,
    siswa: 0,
    bayarBulanIniNominal: 0, // ✅ total nominal semua cabang
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    // 1) Total cabang realtime
    const unsubBranches = onSnapshot(
      collection(db, "branches"),
      (snap) => {
        setSummary((p) => ({ ...p, cabang: snap.size }));
      },
      (err) => console.log("branches err:", err)
    );

    // 2) Total admin cabang realtime
    const qAdmins = query(
      collection(db, "users"),
      where("role", "==", "ADMIN_CABANG")
    );
    const unsubAdmins = onSnapshot(
      qAdmins,
      (snap) => {
        const count = snap.docs.filter(
          (d) => (d.data() as any)?.active !== false
        ).length;
        setSummary((p) => ({ ...p, admin: count }));
      },
      (err) => console.log("admins err:", err)
    );

    // 3) Total siswa realtime
    const unsubStudents = onSnapshot(
      collection(db, "students"),
      (snap) => {
        setSummary((p) => ({ ...p, siswa: snap.size }));
      },
      (err) => console.log("students err:", err)
    );

    // 4) ✅ Nominal bayar bulan ini (TOTAL semua cabang) realtime
    const qInvoices = query(
      collection(db, "invoices"),
      where("monthKey", "==", mkNow),
      where("status", "==", "PAID")
    );
    const unsubInvoices = onSnapshot(
      qInvoices,
      (snap) => {
        let total = 0;
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          total += Number(data.total || 0) || 0;
        });
        setSummary((p) => ({ ...p, bayarBulanIniNominal: total }));
        setLoading(false);
      },
      (err) => {
        console.log("invoices err:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubBranches();
      unsubAdmins();
      unsubStudents();
      unsubInvoices();
    };
  }, [mkNow]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            // ✅ ini kunci: footbar + safe area bottom (gesture/nav bar) + extra ruang
            paddingBottom: tabH + insets.bottom + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>SPP Mobile</Text>
            <Text style={styles.brandSub}>Superadmin</Text>
          </View>

          <View style={styles.chip}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color="#1E40AF"
            />
            <Text style={styles.chipText}>Superadmin</Text>
          </View>
        </View>

        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>
          Ringkasan realtime seluruh cabang (admin, siswa, dan total pembayaran
          bulan ini).
        </Text>

        {/* Summary cards */}
        <View style={styles.grid}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Total Cabang</Text>
            {loading ? (
              <MiniLoading />
            ) : (
              <Text style={styles.miniValue}>{summary.cabang}</Text>
            )}
          </View>

          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Admin Cabang</Text>
            {loading ? (
              <MiniLoading />
            ) : (
              <Text style={styles.miniValue}>{summary.admin}</Text>
            )}
          </View>

          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Total Siswa</Text>
            {loading ? (
              <MiniLoading />
            ) : (
              <Text style={styles.miniValue}>{summary.siswa}</Text>
            )}
          </View>

          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>Bayar Bulan Ini</Text>
            {loading ? (
              <MiniLoading />
            ) : (
              <Text
                style={[styles.miniValue, styles.miniValueMoney]}
                numberOfLines={1}
              >
                {rupiah(summary.bayarBulanIniNominal)}
              </Text>
            )}
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aksi Cepat</Text>
          <Text style={styles.cardSub}>
            Shortcut untuk mengatur fitur utama.
          </Text>

          <View style={{ gap: 8, marginTop: 10 }}>
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

        <View style={{ height: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniLoading() {
  return (
    <View
      style={{
        marginTop: 8,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="small" />
      <Text style={{ fontFamily: F.bold, color: "#0F172A", fontSize: 12 }}>
        Memuat...
      </Text>
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
      <Text style={styles.actionText} numberOfLines={2}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const { width: W } = Dimensions.get("window");
const IS_SMALL = W < 380;

const styles = StyleSheet.create({
  // ✅ lebih rapat tapi tetap lega (responsif)
  scroll: {
    paddingHorizontal: IS_SMALL ? 14 : 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
  },

  header: {
    paddingHorizontal: 2,
    paddingTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontFamily: F.extrabold,
    color: "#1D4ED8",
    letterSpacing: 0.2,
    fontSize: IS_SMALL ? 14 : 15,
  },
  brandSub: {
    marginTop: 2,
    fontFamily: F.semibold,
    color: "#64748B",
    fontSize: 12,
  },

  chip: {
    backgroundColor: "rgba(219,234,254,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { fontFamily: F.bold, color: "#1E40AF", fontSize: 12 },

  // ✅ judul diperkecil biar tidak “gede”
  title: {
    fontFamily: F.extrabold,
    fontSize: IS_SMALL ? 20 : 22,
    color: "#0F172A",
  },
  subtitle: {
    fontFamily: F.semibold,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 2,
    fontSize: 12,
  },

  // ✅ grid lebih rapat
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },

  miniCard: {
    width: "48.6%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  miniLabel: { fontFamily: F.semibold, color: "#64748B", fontSize: 12 },
  miniValue: {
    marginTop: 6,
    fontSize: IS_SMALL ? 18 : 19,
    fontFamily: F.extrabold,
    color: "#0F172A",
  },
  miniValueMoney: {
    fontSize: IS_SMALL ? 16 : 17, // ✅ nominal uang biasanya panjang
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTitle: { fontFamily: F.extrabold, fontSize: 16, color: "#0F172A" },
  cardSub: {
    marginTop: 4,
    fontFamily: F.semibold,
    color: "#64748B",
    lineHeight: 17,
    fontSize: 12,
  },

  actionItem: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1, fontFamily: F.bold, color: "#0F172A", fontSize: 13 },

  secondaryBtn: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 11,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryText: { fontFamily: F.bold, color: "#0F172A", fontSize: 13 },
});
