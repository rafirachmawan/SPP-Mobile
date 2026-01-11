// FILE: app/admin/riwayat.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// ✅ Safe Area + TabBar height (untuk samakan jarak)
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

// ✅ DatePicker
import DateTimePicker from "@react-native-community/datetimepicker";

// ✅ Firebase
import { auth, db } from "../../firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

type Tx = {
  id: string;
  tanggal: Date; // paidAt
  nama: string; // studentName
  bulan: string; // monthLabel
  nominal: number; // total dibayar
  status: "Lunas" | "Beasiswa" | "Pending";
  metode: "Cash" | "Transfer";

  // ✅ bukti pembayaran (BASE64 Data URL dari Firestore)
  proofDataUrl?: string | null;
  proofType?: "camera" | "gallery" | "upload" | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatTanggal(d: Date) {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function bulanIndo(d: Date) {
  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${bulan[d.getMonth()]} ${d.getFullYear()}`;
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function atStartOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function atEndOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function monthLabelFromKey(yyyyMM?: string) {
  const mk = String(yyyyMM || "").trim();
  const [yStr, mStr] = mk.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12)
    return mk || "-";
  return bulanIndo(new Date(y, m - 1, 1));
}

export default function AdminRiwayatTab() {
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  // =========================
  // ✅ PROFIL CABANG ADMIN LOGIN
  // =========================
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

  // =========================
  // ✅ RANGE TANGGAL
  // =========================
  const today = new Date();
  const [fromDate, setFromDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [toDate, setToDate] = useState<Date>(today);

  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);

  // Android: modal picker
  const [androidPicker, setAndroidPicker] = useState<null | "from" | "to">(
    null
  );

  // filter aktif
  const [appliedFrom, setAppliedFrom] = useState<Date>(atStartOfDay(fromDate));
  const [appliedTo, setAppliedTo] = useState<Date>(atEndOfDay(toDate));

  function applyFilter() {
    const f = atStartOfDay(fromDate);
    const t = atEndOfDay(toDate);
    if (f.getTime() > t.getTime()) {
      setAppliedFrom(atStartOfDay(toDate));
      setAppliedTo(atEndOfDay(fromDate));
      return;
    }
    setAppliedFrom(f);
    setAppliedTo(t);
  }

  // =========================
  // ✅ DATA TRANSAKSI DARI FIRESTORE
  // =========================
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    if (!branchId) {
      setTxs([]);
      setLoadingTx(false);
      return;
    }

    setLoadingTx(true);

    const fTs = Timestamp.fromDate(atStartOfDay(appliedFrom));
    const tTs = Timestamp.fromDate(atEndOfDay(appliedTo));

    const qRef = query(
      collection(db, "payments"),
      where("branchId", "==", branchId),
      where("paidAt", ">=", fTs),
      where("paidAt", "<=", tTs),
      orderBy("paidAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Tx[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const paidAt: Date = data?.paidAt?.toDate
            ? data.paidAt.toDate()
            : new Date();

          const nominal = Number(data.nominal || 0) || 0;
          const total = Number(data.total || 0) || 0;

          const rawStatus = String(data.status || "PAID").toUpperCase();
          const status: Tx["status"] =
            rawStatus !== "PAID"
              ? "Pending"
              : total <= 0 || nominal <= 0
              ? "Beasiswa"
              : "Lunas";

          const metode: Tx["metode"] =
            String(data.metode || "Cash") === "Transfer" ? "Transfer" : "Cash";

          const monthLabel =
            String(data.monthLabel || "").trim() ||
            (data.monthKey
              ? monthLabelFromKey(String(data.monthKey))
              : bulanIndo(paidAt));

          return {
            id: d.id,
            tanggal: paidAt,
            nama: String(data.studentName || data.nama || "-").trim() || "-",
            bulan: monthLabel,
            nominal: Number(total || nominal || 0) || 0,
            status,
            metode,

            // ✅ FIX: baca field yang benar dari bayar.tsx
            proofDataUrl: data.proofDataUrl || null,
            proofType: (data.proofType as any) || null,
          };
        });

        setTxs(rows);
        setLoadingTx(false);
      },
      (err: any) => {
        // ✅ FIX: Tidak tampil warning apa pun
        console.log("riwayat onSnapshot error:", err?.code, err?.message);
        setLoadingTx(false);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, appliedFrom, appliedTo]);

  // =========================
  // ✅ FILTER LOCAL (pengaman)
  // =========================
  const filtered = useMemo(() => {
    const f = atStartOfDay(appliedFrom);
    const t = atEndOfDay(appliedTo);
    return txs.filter((x) => {
      const time = x.tanggal.getTime();
      return time >= f.getTime() && time <= t.getTime();
    });
  }, [txs, appliedFrom, appliedTo]);

  const grouped = useMemo(() => {
    const groups: { date: Date; items: Tx[] }[] = [];
    for (const tx of filtered) {
      const day = atStartOfDay(tx.tanggal);
      const last = groups[groups.length - 1];
      if (last && isSameDay(last.date, day)) last.items.push(tx);
      else groups.push({ date: day, items: [tx] });
    }
    return groups;
  }, [filtered]);

  // =========================
  // ✅ PREVIEW BUKTI MODAL
  // =========================
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTx, setPreviewTx] = useState<Tx | null>(null);

  function openPreview(tx: Tx) {
    if (!tx.proofDataUrl) return;
    setPreviewTx(tx);
    setPreviewOpen(true);
  }
  function closePreview() {
    setPreviewOpen(false);
    setPreviewTx(null);
  }

  // =========================
  // ✅ UI date picker
  // =========================
  function openFromPicker() {
    if (Platform.OS === "android") setAndroidPicker("from");
    else setShowFrom(true);
  }
  function openToPicker() {
    if (Platform.OS === "android") setAndroidPicker("to");
    else setShowTo(true);
  }

  function onChangeFrom(_: any, selected?: Date) {
    if (Platform.OS !== "android") {
      if (selected) setFromDate(selected);
      return;
    }
    if (selected) setFromDate(selected);
    setAndroidPicker(null);
  }

  function onChangeTo(_: any, selected?: Date) {
    if (Platform.OS !== "android") {
      if (selected) setToDate(selected);
      return;
    }
    if (selected) setToDate(selected);
    setAndroidPicker(null);
  }

  const headerLoading = profileLoading;

  // ✅ SAMAKAN JARAK seperti Siswa/Bayar
  const topPad = Math.max(insets.top + 8, 18);
  const bottomPad = tabH + 18;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={[]}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>SPP Mobile</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {headerLoading ? "Memuat..." : branchName}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>Riwayat Pembayaran</Text>
        <Text style={styles.subtitle}>
          Pilih range tanggal, lalu lihat daftar transaksi pembayaran{" "}
          <Text style={{ fontWeight: "900", color: "#0F172A" }}>
            (bukan rekap total)
          </Text>
          .
        </Text>

        {/* FILTER RANGE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filter Tanggal</Text>

          <View style={styles.rangeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Dari</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.dateBtn}
                onPress={openFromPicker}
                disabled={headerLoading}
              >
                <Ionicons name="calendar-outline" size={18} color="#0F172A" />
                <Text style={styles.dateText}>{formatTanggal(fromDate)}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ width: 10 }} />

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sampai</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.dateBtn}
                onPress={openToPicker}
                disabled={headerLoading}
              >
                <Ionicons name="calendar-outline" size={18} color="#0F172A" />
                <Text style={styles.dateText}>{formatTanggal(toDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.applyBtn, headerLoading && { opacity: 0.6 }]}
            onPress={applyFilter}
            disabled={headerLoading}
          >
            <Ionicons name="filter-outline" size={18} color="#fff" />
            <Text style={styles.applyText}>Tampilkan</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            * Data diambil dari Firestore (payments) sesuai cabang admin yang
            login.
          </Text>
        </View>

        {/* LIST TRANSAKSI */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Daftar Transaksi</Text>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{filtered.length} trx</Text>
            </View>
          </View>

          {headerLoading ? (
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={[styles.note, { marginTop: 10 }]}>
                Memuat profil cabang...
              </Text>
            </View>
          ) : loadingTx ? (
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={[styles.note, { marginTop: 10 }]}>
                Memuat transaksi...
              </Text>
            </View>
          ) : grouped.length === 0 ? (
            <Text style={[styles.note, { marginTop: 12 }]}>
              Tidak ada transaksi pada range ini.
            </Text>
          ) : (
            <View style={{ marginTop: 12, gap: 12 }}>
              {grouped.map((g) => (
                <View key={g.date.toISOString()}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayText}>{formatTanggal(g.date)}</Text>
                  </View>

                  <View style={{ gap: 10, marginTop: 10 }}>
                    {g.items.map((x) => {
                      const hasProof = !!x.proofDataUrl;
                      return (
                        <TouchableOpacity
                          key={x.id}
                          activeOpacity={0.9}
                          onPress={() => (hasProof ? openPreview(x) : null)}
                          style={styles.txItem}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name} numberOfLines={1}>
                              {x.nama}
                            </Text>
                            <Text style={styles.sub}>
                              {x.bulan} • {x.metode}
                              {hasProof ? " • Bukti" : ""}
                            </Text>
                            <Text style={styles.money}>
                              Rp {x.nominal.toLocaleString("id-ID")}
                            </Text>
                          </View>

                          {/* thumbnail bukti */}
                          <View style={{ alignItems: "flex-end", gap: 8 }}>
                            <View
                              style={[
                                styles.badge,
                                x.status === "Lunas"
                                  ? styles.badgeOk
                                  : x.status === "Beasiswa"
                                  ? styles.badgeInfo
                                  : styles.badgeWarn,
                              ]}
                            >
                              <Text style={styles.badgeText2}>{x.status}</Text>
                            </View>

                            {hasProof ? (
                              <Image
                                source={{ uri: x.proofDataUrl as string }}
                                style={styles.thumb}
                              />
                            ) : (
                              <View style={styles.thumbEmpty}>
                                <Ionicons
                                  name="image-outline"
                                  size={18}
                                  color="#94A3B8"
                                />
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.note}>
            * Ini list transaksi per pembayaran (bukan rekap). Sumber: payments.
          </Text>
        </View>

        <View style={{ height: Platform.OS === "ios" ? 8 : 16 }} />
      </ScrollView>

      {/* ✅ MODAL PREVIEW BUKTI */}
      <Modal
        visible={previewOpen}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Bukti Pembayaran</Text>
              <TouchableOpacity onPress={closePreview} style={styles.xBtn}>
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {!previewTx?.proofDataUrl ? (
              <Text style={[styles.note, { marginTop: 12 }]}>
                Tidak ada bukti.
              </Text>
            ) : (
              <>
                <View style={{ marginTop: 12 }}>
                  <Image
                    source={{ uri: previewTx.proofDataUrl }}
                    style={styles.previewImg}
                  />
                </View>

                <View style={styles.previewMeta}>
                  <Text style={styles.previewMetaText}>
                    <Text style={{ fontWeight: "900" }}>{previewTx.nama}</Text>
                    {"\n"}
                    {previewTx.bulan} • {previewTx.metode}
                    {"\n"}
                    {formatTanggal(previewTx.tanggal)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* iOS pickers */}
      {Platform.OS === "ios" && showFrom && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display="spinner"
          onChange={(e, d) => {
            if (d) setFromDate(d);
          }}
        />
      )}
      {Platform.OS === "ios" && showTo && (
        <DateTimePicker
          value={toDate}
          mode="date"
          display="spinner"
          onChange={(e, d) => {
            if (d) setToDate(d);
          }}
        />
      )}

      {/* Android modal picker */}
      <Modal visible={androidPicker !== null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.pickerCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>
                Pilih tanggal {androidPicker === "from" ? "Dari" : "Sampai"}
              </Text>
              <TouchableOpacity
                onPress={() => setAndroidPicker(null)}
                style={styles.xBtn}
              >
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <View style={{ height: 10 }} />

            <DateTimePicker
              value={androidPicker === "from" ? fromDate : toDate}
              mode="date"
              display="calendar"
              onChange={androidPicker === "from" ? onChangeFrom : onChangeTo}
            />

            <Text style={[styles.note, { marginTop: 10 }]}>
              (Klik di kalender untuk memilih)
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },

  header: {
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontWeight: "900",
    color: "#1D4ED8",
    letterSpacing: 0.4,
  },
  chip: {
    backgroundColor: "rgba(219,234,254,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    maxWidth: "65%",
  },
  chipText: {
    color: "#1E40AF",
    fontWeight: "900",
    fontSize: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },
  subtitle: {
    color: "#64748B",
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 2,
  },

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
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  label: { marginTop: 12, fontWeight: "900", color: "#0F172A" },

  rangeRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  dateBtn: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: { fontWeight: "900", color: "#0F172A" },

  applyBtn: {
    marginTop: 14,
    backgroundColor: "#0EA5E9",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  applyText: { color: "white", fontWeight: "900", fontSize: 15 },

  badgeCount: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

  dayHeader: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dayText: { fontWeight: "900", color: "#0F172A", fontSize: 12 },

  txItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: { fontWeight: "900", color: "#0F172A", fontSize: 15 },
  sub: { marginTop: 6, color: "#64748B", fontWeight: "700" },
  money: { marginTop: 6, fontWeight: "900", color: "#0F172A", fontSize: 16 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  badgeInfo: { backgroundColor: "#DBEAFE", borderColor: "#BFDBFE" },
  badgeWarn: { backgroundColor: "#FEF9C3", borderColor: "#FDE68A" },
  badgeText2: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  thumbEmpty: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  pickerCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "white",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  xBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ✅ preview modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  previewCard: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  previewImg: {
    width: "100%",
    height: 360,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  previewMeta: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    padding: 10,
  },
  previewMetaText: { color: "#0F172A", fontWeight: "800", lineHeight: 18 },
});
