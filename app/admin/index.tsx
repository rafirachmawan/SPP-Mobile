// FILE: app/admin/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ✅ Firebase (TIDAK DIUBAH)
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

/* ===================== THEME ===================== */
const F = {
  regular: "Inter_400Regular",
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
  card: "rgba(255,255,255,0.92)",
  primary: "#0EA5E9",
};

/* ===================== UTIL ===================== */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function rupiah(n: number) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

const { width: W } = Dimensions.get("window");
const IS_SMALL = W < 380;

/* ===================== COMPONENT ===================== */
export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mkNow = useMemo(() => monthKeyOf(new Date()), []);

  /* ===== PROFILE & BRANCH (TIDAK DIUBAH) ===== */
  const [branchId, setBranchId] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("-");
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setProfileLoading(true);
        const u = auth.currentUser;
        if (!u) return;

        const uSnap = await getDoc(doc(db, "users", u.uid));
        if (!uSnap.exists()) return;

        const data = uSnap.data() as any;
        const bid = String(data.cabangId || data.branchId || "").trim();
        if (!bid) return;

        if (!mounted) return;
        setBranchId(bid);

        const bSnap = await getDoc(doc(db, "branches", bid));
        if (bSnap.exists()) {
          const b = bSnap.data() as any;
          setBranchName(String(b.name || b.branchName || "-").trim() || "-");
        }
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ===== STATS (TIDAK DIUBAH) ===== */
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [sudahBayarBulanIni, setSudahBayarBulanIni] = useState(0);
  const [nominalMasukBulanIni, setNominalMasukBulanIni] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!branchId) return;
    const qRef = query(
      collection(db, "students"),
      where("branchId", "==", branchId),
    );
    const unsub = onSnapshot(qRef, (snap) => setTotalSiswa(snap.size));
    return () => unsub();
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    const qInv = query(
      collection(db, "invoices"),
      where("branchId", "==", branchId),
      where("monthKey", "==", mkNow),
      where("status", "==", "PAID"),
    );

    const unsub = onSnapshot(qInv, (snap) => {
      const uniq = new Set<string>();
      let totalNominal = 0;

      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const sid = String(data.studentId || "").trim();
        if (sid) uniq.add(sid);
        totalNominal += Number(data.total || 0) || 0;
      });

      setSudahBayarBulanIni(uniq.size);
      setNominalMasukBulanIni(totalNominal);
      setStatsLoading(false);
    });

    return () => unsub();
  }, [branchId, mkNow]);

  /* ===== MENU (TIDAK DIUBAH) ===== */
  const actions = [
    {
      title: "Bayar SPP",
      desc: "Cari siswa, buat invoice, lalu bayar.",
      icon: "receipt-outline",
      to: "/admin/bayar",
    },
    {
      title: "Mutasi Siswa",
      desc: "Riwayat pembayaran per siswa.",
      icon: "people-outline",
      to: "/admin/siswa",
    },
    {
      title: "Kelola Siswa",
      desc: "Tambah & hapus siswa cabang.",
      icon: "person-add-outline",
      to: "/admin/kelola-siswa",
    },
    {
      title: "Riwayat",
      desc: "Riwayat semua transaksi.",
      icon: "time-outline",
      to: "/admin/riwayat",
    },
  ];

  const topPad = Math.max(insets.top + 12, 20);

  /* ===================== UI ===================== */
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= HEADER ================= */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Dashboard Admin</Text>
            <Text style={styles.headerSub}>
              Ringkasan aktivitas & pembayaran cabang
            </Text>
          </View>

          {/* CHIP UNIT DI KANAN ATAS */}
          <View style={styles.branchChipTop}>
            <Text style={styles.branchText}>
              {profileLoading ? "Memuat..." : branchName}
            </Text>
          </View>
        </View>

        {/* ================= KPI UTAMA ================= */}
        <View style={styles.kpiMain}>
          <Text style={styles.kpiLabel}>Total Masuk Bulan Ini</Text>

          {statsLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.kpiValue}>{rupiah(nominalMasukBulanIni)}</Text>
          )}
        </View>

        {/* ================= KPI PENDUKUNG ================= */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiSmall}>
            <Text style={styles.kpiSmallLabel}>Bayar Bulan Ini</Text>
            <Text style={styles.kpiSmallValue}>{sudahBayarBulanIni}</Text>
          </View>

          <View style={styles.kpiSmall}>
            <Text style={styles.kpiSmallLabel}>Total Siswa</Text>
            <Text style={styles.kpiSmallValue}>{totalSiswa}</Text>
          </View>
        </View>

        {/* ================= MENU ================= */}
        <View style={styles.menuCard}>
          <Text style={styles.menuTitle}>Menu Aksi</Text>

          {actions.map((a) => (
            <TouchableOpacity
              key={a.title}
              activeOpacity={0.9}
              onPress={() => router.push(a.to as any)}
              style={styles.menuItem}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={a.icon as any} size={20} color="#2563EB" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.menuText}>{a.title}</Text>
                <Text style={styles.menuDesc}>{a.desc}</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
}

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  branchChipTop: {
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    maxWidth: "45%",
  },

  branchText: {
    fontFamily: F.extrabold,
    fontSize: 12,
    color: "#1E40AF",
  },

  scroll: {
    paddingHorizontal: IS_SMALL ? 14 : 16,
    paddingBottom: 22,
  },

  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: F.extrabold,
    fontSize: 22,
    color: THEME.text,
  },
  headerSub: {
    marginTop: 6,
    fontFamily: F.semibold,
    fontSize: 12,
    color: THEME.sub,
  },
  branchChip: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  kpiMain: {
    backgroundColor: THEME.primary,
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

  kpiRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  kpiSmall: {
    flex: 1,
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  kpiSmallLabel: {
    fontFamily: F.semibold,
    fontSize: 12,
    color: THEME.sub,
  },
  kpiSmallValue: {
    marginTop: 6,
    fontFamily: F.extrabold,
    fontSize: 20,
    color: THEME.text,
  },

  menuCard: {
    marginTop: 16,
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  menuTitle: {
    fontFamily: F.extrabold,
    fontSize: 14,
    color: THEME.text,
    marginBottom: 8,
  },
  menuItem: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    fontFamily: F.extrabold,
    fontSize: 13,
    color: THEME.text,
  },
  menuDesc: {
    marginTop: 2,
    fontFamily: F.semibold,
    fontSize: 12,
    color: THEME.sub,
  },
});
