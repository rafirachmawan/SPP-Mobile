// FILE: app/admin/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // monthKey bulan ini (kalau lewat tengah malam pergantian bulan, nanti re-mount app / reload screen akan update)
  const mkNow = useMemo(() => monthKeyOf(new Date()), []);

  // ===================== CABANG ADMIN LOGIN =====================
  const [branchId, setBranchId] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("-");
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setProfileLoading(true);

        const u = auth.currentUser;
        if (!u) {
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        const uSnap = await getDoc(doc(db, "users", u.uid));
        if (!uSnap.exists()) {
          Alert.alert("Gagal", "Data akun tidak ditemukan.");
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        const data = uSnap.data() as any;

        const role = String(data.role || "").trim();
        if (role !== "ADMIN_CABANG" && role !== "SUPERADMIN") {
          Alert.alert("Akses ditolak", "Akun ini bukan admin cabang.");
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        if (data.active === false) {
          Alert.alert("Akun Nonaktif", "Akun kamu sedang dinonaktifkan.");
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        const bid = String(data.cabangId || data.branchId || "").trim();
        if (!bid) {
          Alert.alert(
            "Cabang belum diset",
            "Akun admin ini belum punya cabangId/branchId. Set dulu dari SUPERADMIN."
          );
          if (mounted) {
            setBranchId("");
            setBranchName("-");
          }
          return;
        }

        if (!mounted) return;
        setBranchId(bid);

        const bSnap = await getDoc(doc(db, "branches", bid));
        if (bSnap.exists()) {
          const b = bSnap.data() as any;
          setBranchName(String(b.name || b.branchName || "-").trim() || "-");
        } else {
          setBranchName(
            String(data.branchName || data.cabangName || "-") || "-"
          );
        }
      } catch (e: any) {
        console.log(e);
        Alert.alert("Gagal", e?.message || "Tidak bisa memuat profil admin.");
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ===================== STATS =====================
  const [totalSiswa, setTotalSiswa] = useState<number>(0);

  // ✅ realtime: unik siswa PAID bulan ini
  const [sudahBayarBulanIni, setSudahBayarBulanIni] = useState<number>(0);

  // ✅ realtime: total uang masuk dari invoice PAID bulan ini
  const [nominalMasukBulanIni, setNominalMasukBulanIni] = useState<number>(0);

  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  // Total siswa realtime
  useEffect(() => {
    if (!branchId) {
      setTotalSiswa(0);
      return;
    }

    const qRef = query(
      collection(db, "students"),
      where("branchId", "==", branchId)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => setTotalSiswa(snap.size),
      (err) => {
        console.log(err);
        setTotalSiswa(0);
      }
    );

    return () => unsub();
  }, [branchId]);

  // ✅ Bayar bulan ini realtime (UNIK siswa) + nominal masuk bulan ini realtime
  useEffect(() => {
    if (!branchId) {
      setSudahBayarBulanIni(0);
      setNominalMasukBulanIni(0);
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);

    const qInv = query(
      collection(db, "invoices"),
      where("branchId", "==", branchId),
      where("monthKey", "==", mkNow),
      where("status", "==", "PAID")
    );

    const unsub = onSnapshot(
      qInv,
      (snap) => {
        const uniq = new Set<string>();
        let totalNominal = 0;

        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const sid = String(data.studentId || "").trim();
          if (sid) uniq.add(sid);

          // uang masuk = total yg dibayar
          totalNominal += Number(data.total || 0) || 0;
        });

        setSudahBayarBulanIni(uniq.size);
        setNominalMasukBulanIni(totalNominal);
        setStatsLoading(false);
      },
      (err) => {
        console.log(err);
        setSudahBayarBulanIni(0);
        setNominalMasukBulanIni(0);
        setStatsLoading(false);
      }
    );

    return () => unsub();
  }, [branchId, mkNow]);

  const stats = useMemo(
    () => [
      {
        label: "Total Siswa",
        value: profileLoading ? "-" : String(totalSiswa),
        icon: "school-outline",
      },
      {
        label: "Bayar Bulan Ini",
        value: profileLoading ? "-" : String(sudahBayarBulanIni),
        icon: "checkmark-circle-outline",
      },
      {
        label: "Nominal Masuk Bulan Ini",
        value: profileLoading ? "-" : rupiah(nominalMasukBulanIni),
        icon: "cash-outline",
      },
    ],
    [profileLoading, totalSiswa, sudahBayarBulanIni, nominalMasukBulanIni]
  );

  const actions = [
    {
      title: "Bayar SPP",
      desc: "Cari siswa → muncul invoice → Bayar.",
      icon: "receipt-outline",
      to: "/admin/bayar",
    },
    {
      title: "Siswa",
      desc: "Daftar siswa cabang ini + status pembayaran.",
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

  const topPad = Math.max(insets.top + 8, 18);
  const showLoading = profileLoading || statsLoading;

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
            <Text style={styles.pillText}>{branchName}</Text>
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

              {showLoading ? (
                <View
                  style={{
                    marginTop: 6,
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="small" />
                  <Text style={[styles.statValue, { fontSize: 14 }]}>
                    Memuat...
                  </Text>
                </View>
              ) : (
                <Text style={styles.statValue}>{s.value}</Text>
              )}
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

        {!profileLoading && !branchId && (
          <Text style={[styles.warn, { marginTop: 10 }]}>
            Cabang admin belum diset. Set cabangId/branchId di users/{`{uid}`}{" "}
            dulu.
          </Text>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 18,
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

  warn: {
    textAlign: "center",
    color: "#EF4444",
    fontWeight: "800",
    fontSize: 12,
  },
});
