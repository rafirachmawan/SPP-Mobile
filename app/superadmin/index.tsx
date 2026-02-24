// FILE: app/superadmin/index.tsx
// ✅ CLEAN & PROFESSIONAL UI — LOGIC DIPERBAIKI (ADMIN UNIT)

import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
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

// ✅ Firebase
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/1DE0FwlqtTKN4Uj3ZcfiRYARoYLnPKXcy-iZXxcEKFqw/edit?gid=1484692081#gid=1484692081";

// ================= FONT MAP =================
const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

// ================= UTIL =================
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
  const tabH = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const mkNow = useMemo(() => monthKeyOf(new Date()), []);

  // ================= STATE =================
  const [summary, setSummary] = useState({
    cabang: 0,
    admin: 0,
    siswa: 0,
    bayarBulanIniNominal: 0,
  });
  const [loading, setLoading] = useState(true);

  // ================= REALTIME EFFECT =================
  useEffect(() => {
    setLoading(true);

    // ✅ TOTAL UNIT
    const unsubBranches = onSnapshot(collection(db, "branches"), (snap) => {
      setSummary((p) => ({ ...p, cabang: snap.size }));
    });

    // ✅ ADMIN UNIT (FIX: AMBIL DARI branch_admins)
    const qAdmins = query(collection(db, "branch_admins"));
    const unsubAdmins = onSnapshot(qAdmins, (snap) => {
      const count = snap.docs.filter(
        (d) => (d.data() as any)?.aktif !== false,
      ).length;

      setSummary((p) => ({ ...p, admin: count }));
    });

    // ✅ TOTAL SISWA
    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      setSummary((p) => ({ ...p, siswa: snap.size }));
    });

    // ✅ PEMBAYARAN BULAN INI (REAL MONEY FROM PAYMENTS)
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );

    const endOfNow = new Date();

    const qPayments = query(
      collection(db, "payments"),
      where("paidAt", ">=", Timestamp.fromDate(startOfMonth)),
      where("paidAt", "<=", Timestamp.fromDate(endOfNow)),
    );

    const unsubPayments = onSnapshot(qPayments, (snap) => {
      let total = 0;

      snap.docs.forEach((d) => {
        const data = d.data() as any;
        total += Number(data.totalBayar || 0) || 0;
      });

      setSummary((p) => ({
        ...p,
        bayarBulanIniNominal: total,
      }));

      setLoading(false);
    });

    return () => {
      unsubBranches();
      unsubAdmins();
      unsubStudents();
      unsubPayments(); // ✅ ganti dari unsubInvoices
    };
  }, [mkNow]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: tabH + insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= HEADER ================= */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Dashboard Superadmin</Text>
            <Text style={styles.headerSub}>Ringkasan global seluruh unit</Text>
          </View>

          <View style={styles.roleChip}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color="#1E40AF"
            />
            <Text style={styles.roleText}>Superadmin</Text>
          </View>
        </View>

        {/* ================= KPI UTAMA ================= */}
        <View style={styles.kpiMain}>
          <Text style={styles.kpiLabel}>Total Masuk Bulan Ini</Text>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.kpiValue}>
              {rupiah(summary.bayarBulanIniNominal)}
            </Text>
          )}
        </View>

        {/* ================= KPI GRID ================= */}
        <View style={styles.kpiGrid}>
          <KpiBox label="Total Unit" value={summary.cabang} loading={loading} />
          <KpiBox label="Admin Unit" value={summary.admin} loading={loading} />
          <KpiBox label="Total Siswa" value={summary.siswa} loading={loading} />
          <KpiBox
            label="Bayar Bulan Ini"
            value={rupiah(summary.bayarBulanIniNominal)}
            loading={loading}
            money
          />
        </View>

        {/* ================= MENU AKSI ================= */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Menu Aksi</Text>

          <Action
            icon="business-outline"
            label="Kelola Unit"
            onPress={() => router.push("/superadmin/cabang")}
          />
          <Action
            icon="people-outline"
            label="Kelola Admin Unit"
            onPress={() => router.push("/superadmin/admin-cabang")}
          />
          <Action
            icon="gift-outline"
            label="Setting Hadiah Spin"
            onPress={() => router.push("/superadmin/spin")}
          />
          <Action
            icon="school-outline"
            label="Siswa per Unit"
            onPress={() => router.push("/superadmin/siswa")}
          />
          <Action
            icon="logo-google"
            label="Rekapan SPP"
            onPress={() => Linking.openURL(SPREADSHEET_URL)}
          />

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.secondaryBtn}
            onPress={() => router.push("/superadmin/master")}
          >
            <Ionicons name="apps-outline" size={18} color="#0F172A" />
            <Text style={styles.secondaryText}>Buka Menu Master</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ================= COMPONENT =================
function KpiBox({
  label,
  value,
  loading,
  money,
}: {
  label: string;
  value: any;
  loading: boolean;
  money?: boolean;
}) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiSmallLabel}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <Text
          style={[styles.kpiSmallValue, money && { fontSize: 15 }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
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
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

// ================= STYLE =================
const { width: W } = Dimensions.get("window");
const IS_SMALL = W < 380;

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: IS_SMALL ? 14 : 16,
    paddingTop: 12,
    gap: 14,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontFamily: F.extrabold,
    fontSize: IS_SMALL ? 20 : 22,
    color: "#0F172A",
  },
  headerSub: {
    marginTop: 4,
    fontFamily: F.semibold,
    fontSize: 12,
    color: "#64748B",
  },

  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  roleText: {
    fontFamily: F.bold,
    fontSize: 12,
    color: "#1E40AF",
  },

  kpiMain: {
    backgroundColor: "#0EA5E9",
    borderRadius: 20,
    padding: 16,
  },
  kpiLabel: {
    fontFamily: F.semibold,
    fontSize: 12,
    color: "#E0F2FE",
  },
  kpiValue: {
    marginTop: 8,
    fontFamily: F.extrabold,
    fontSize: 26,
    color: "#FFFFFF",
  },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiBox: {
    width: "48.6%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  kpiSmallLabel: {
    fontFamily: F.semibold,
    fontSize: 12,
    color: "#64748B",
  },
  kpiSmallValue: {
    marginTop: 6,
    fontFamily: F.extrabold,
    fontSize: 18,
    color: "#0F172A",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  cardTitle: {
    fontFamily: F.extrabold,
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 8,
  },

  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    marginTop: 8,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    fontFamily: F.bold,
    fontSize: 13,
    color: "#0F172A",
  },

  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  secondaryText: {
    fontFamily: F.bold,
    fontSize: 13,
    color: "#0F172A",
  },
});
