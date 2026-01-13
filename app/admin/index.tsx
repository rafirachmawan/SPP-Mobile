// FILE: app/admin/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ✅ Firebase
import { db, auth } from "../../firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

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

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mkNow = useMemo(() => monthKeyOf(new Date()), []);

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

  const [totalSiswa, setTotalSiswa] = useState<number>(0);
  const [sudahBayarBulanIni, setSudahBayarBulanIni] = useState<number>(0);
  const [nominalMasukBulanIni, setNominalMasukBulanIni] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!branchId) return;
    const qRef = query(
      collection(db, "students"),
      where("branchId", "==", branchId)
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
      where("status", "==", "PAID")
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

  const stats = useMemo(
    () => [
      {
        label: "Total Siswa",
        value: String(totalSiswa),
        icon: "school-outline",
      },
      {
        label: "Bayar Bulan Ini",
        value: String(sudahBayarBulanIni),
        icon: "checkmark-circle-outline",
      },
      {
        label: "Nominal Masuk Bulan Ini",
        value: rupiah(nominalMasukBulanIni),
        icon: "cash-outline",
      },
    ],
    [totalSiswa, sudahBayarBulanIni, nominalMasukBulanIni]
  );

  const actions = [
    {
      title: "Bayar SPP",
      desc: "Cari siswa → invoice → bayar.",
      icon: "receipt-outline",
      to: "/admin/bayar",
    },
    {
      title: "Siswa",
      desc: "Daftar siswa cabang.",
      icon: "people-outline",
      to: "/admin/siswa",
    },
    {
      title: "Riwayat",
      desc: "Riwayat pembayaran.",
      icon: "time-outline",
      to: "/admin/riwayat",
    },
  ];

  const topPad = Math.max(insets.top + 8, 16);

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
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.brand}>Shining Sun 🎈</Text>
            <Text style={styles.title}>Dashboard Admin</Text>
            <Text style={styles.subtitle}>
              Kelola pembayaran SPP cabang ini.
            </Text>

            {/* (opsional visual) loading profil */}
            {profileLoading ? (
              <Text style={styles.profileHint}>Memuat profil cabang...</Text>
            ) : null}
          </View>

          {/* CHIP CABANG */}
          <View style={styles.pill}>
            <Text style={styles.pillText} numberOfLines={1}>
              {branchName}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name={s.icon as any} size={18} color="#1D4ED8" />
              </View>

              <Text style={styles.statLabel} numberOfLines={2}>
                {s.label}
              </Text>

              {statsLoading ? (
                <View style={{ marginTop: 6 }}>
                  <ActivityIndicator size="small" />
                </View>
              ) : (
                <Text
                  style={[
                    styles.statValue,
                    s.label === "Nominal Masuk Bulan Ini" &&
                      styles.statValueMoney,
                  ]}
                  numberOfLines={1}
                >
                  {s.value}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Menu Utama</Text>
          <Text style={styles.cardSub}>Pilih fitur.</Text>

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
                <Text style={styles.rowDesc} numberOfLines={2}>
                  {a.desc}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: IS_SMALL ? 14 : 16, paddingBottom: 22 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerLeft: { flex: 1 },

  brand: {
    color: "#2563EB",
    fontFamily: F.extrabold,
    fontSize: IS_SMALL ? 14 : 15,
  },
  title: {
    marginTop: 6,
    fontSize: IS_SMALL ? 20 : 22, // ✅ diperkecil
    fontFamily: F.extrabold,
    color: THEME.text,
  },
  subtitle: {
    marginTop: 6,
    color: THEME.sub,
    fontFamily: F.semibold,
    lineHeight: 18,
    fontSize: 12,
  },
  profileHint: {
    marginTop: 6,
    color: "#94A3B8",
    fontFamily: F.semibold,
    fontSize: 12,
  },

  pill: {
    alignSelf: "flex-start",
    maxWidth: "48%",
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { color: "#1E40AF", fontFamily: F.extrabold, fontSize: 12 },

  statsGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8, // ✅ lebih rapat
  },
  statCard: {
    width: "48.6%",
    backgroundColor: THEME.card,
    borderRadius: 16, // ✅ diperkecil
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 10, // ✅ diperkecil
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statLabel: { color: THEME.sub, fontFamily: F.bold, fontSize: 12 },
  statValue: {
    marginTop: 6,
    color: THEME.text,
    fontFamily: F.extrabold,
    fontSize: IS_SMALL ? 18 : 19,
  },
  statValueMoney: {
    fontSize: IS_SMALL ? 15 : 16, // ✅ nominal biasanya panjang
  },

  card: {
    marginTop: 12,
    backgroundColor: THEME.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 12,
  },
  cardTitle: { fontSize: 15, fontFamily: F.extrabold, color: THEME.text },
  cardSub: {
    marginTop: 4,
    color: THEME.sub,
    fontFamily: F.semibold,
    fontSize: 12,
  },

  rowBtn: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: F.extrabold, color: THEME.text, fontSize: 13 },
  rowDesc: {
    marginTop: 2,
    color: THEME.sub,
    fontFamily: F.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
});
