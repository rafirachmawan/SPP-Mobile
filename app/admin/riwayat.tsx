// FILE: app/admin/riwayat.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ✅ Safe Area + TabBar height (untuk samakan jarak)
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// ✅ DatePicker
import DateTimePicker from "@react-native-community/datetimepicker";

// ✅ Firebase
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

type Tx = {
  id: string;

  // waktu
  tanggal: Date;
  jam?: string;

  // ✅ WAJIB ADA (dipakai di UI)
  bulanBayar: string;
  nominal: number;

  // identitas
  branchName?: string;
  nama: string;
  tipeSiswa?: string;

  // pembayaran
  jenisPembayaran?: string;
  metode: "Cash" | "Transfer";

  nominalSebelumVoucher?: number;
  voucherSpin?: number;
  voucherManual?: number;
  totalVoucher?: number;
  detailVoucherSpin?: string;

  totalBayar: number;

  status: "Lunas" | "Beasiswa" | "Pending";

  proofDataUrl?: string | null;
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

function DetailRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, bold && { fontWeight: "900" }]}>
        {value}
      </Text>
    </View>
  );
}

function nextMonthLabelFromKey(monthKey?: string) {
  if (!monthKey) return "-";
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return "-";
  return bulanIndo(new Date(y, m, 1)); // bulan +1 otomatis
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
            "Akun admin ini belum punya cabangId/branchId. Set dulu dari SUPERADMIN.",
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
            String(data.branchName || data.cabangName || "-") || "-",
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
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [toDate, setToDate] = useState<Date>(today);

  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);

  // Android: modal picker
  const [androidPicker, setAndroidPicker] = useState<null | "from" | "to">(
    null,
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
      orderBy("paidAt", "desc"),
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Tx[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const paidAt: Date = data?.paidAt?.toDate
            ? data.paidAt.toDate()
            : new Date();

          const nominalSebelumVoucher = Number(data.nominalSebelumVoucher || 0);
          const voucherSpin = Number(data.voucherSpin || 0);
          let detailVoucherSpin = "-";

          if (
            Array.isArray(data.voucherSpinEarned) &&
            data.voucherSpinEarned.length > 0
          ) {
            detailVoucherSpin = data.voucherSpinEarned
              .map(
                (v: any) =>
                  `Untuk ${monthLabelFromKey(v.monthKey)}: ${Number(v.nominal).toLocaleString("id-ID")}`,
              )
              .join(", ");
          }

          const voucherManual = Number(data.voucherManual || 0);
          const totalVoucher = Number(data.totalVoucher || 0);
          const totalBayar = Number(data.totalBayar || 0);

          // status PURE dari hasil bayar
          let status: Tx["status"] = "Lunas";
          if (totalBayar === 0 && totalVoucher > 0) status = "Beasiswa";
          if (data.status === "Pending") status = "Pending";

          const metode: Tx["metode"] =
            String(data.metode || "Cash") === "Transfer" ? "Transfer" : "Cash";

          function formatJam(d: Date) {
            return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
          }

          return {
            id: d.id,

            tanggal: paidAt,
            jam: data.jam || formatJam(paidAt),

            branchName: branchName,
            nama: String(data.studentName || data.namaSiswa || "-"),
            tipeSiswa: String(data.studentType || "-"),

            jenisPembayaran: data.jenisPembayaran
              ? String(data.jenisPembayaran)
              : data.monthLabel
                ? `SPP ${data.monthLabel}`
                : "-",

            metode,

            nominalSebelumVoucher,
            voucherSpin,
            voucherManual,
            totalVoucher,
            detailVoucherSpin,

            totalBayar,

            bulanBayar: data.jenisPembayaran
              ? String(data.jenisPembayaran)
              : data.monthLabel
                ? `SPP ${data.monthLabel}`
                : "-",

            nominal: totalBayar,
            status,

            proofDataUrl: data.proofDataUrl || null,
          };
        });

        setTxs(rows);
        setLoadingTx(false);
      },
      (err: any) => {
        // ✅ FIX: Tidak tampil warning apa pun
        console.log("riwayat onSnapshot error:", err?.code, err?.message);
        setLoadingTx(false);
      },
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

  // =========================
  // ✅ HITUNG OMSET (BERDASARKAN TANGGAL BAYAR)
  // =========================
  const totalOmset = useMemo(() => {
    return filtered.reduce((sum, tx) => {
      // ❗ hanya uang masuk nyata
      if (tx.status === "Lunas") {
        return sum + (tx.totalBayar || 0);
      }
      return sum;
    }, 0);
  }, [filtered]);

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
        colors={["#F8FAFC", "#F8FAFC"]}
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
          <Text style={styles.brand}>Shining Sun</Text>
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

            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={styles.badgeCount}>
                <Text style={styles.badgeText}>{filtered.length} trx</Text>
              </View>

              <Text
                style={{ fontWeight: "900", color: "#0F172A", fontSize: 13 }}
              >
                Omset: Rp {totalOmset.toLocaleString("id-ID")}
              </Text>
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
                              Dibayar: {x.bulanBayar} • {x.metode}
                              {hasProof ? " • Bukti" : ""}
                            </Text>

                            <Text style={styles.money}>
                              Rp {(x.nominal ?? 0).toLocaleString("id-ID")}
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
      {/* ANDROID DATE PICKER (NATIVE, TANPA MODAL) */}
      {Platform.OS === "android" && androidPicker === "from" && (
        <DateTimePicker
          value={fromDate}
          mode="date"
          display="calendar"
          onChange={onChangeFrom}
        />
      )}

      {Platform.OS === "android" && androidPicker === "to" && (
        <DateTimePicker
          value={toDate}
          mode="date"
          display="calendar"
          onChange={onChangeTo}
        />
      )}

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
                <View style={styles.proofWrap}>
                  <Image
                    source={{ uri: previewTx.proofDataUrl }}
                    style={styles.proofImg}
                    resizeMode="contain"
                  />
                </View>

                {/* Detail transaksi */}
                <View style={styles.detailCard}>
                  <DetailRow
                    label="Cabang"
                    value={previewTx.branchName || "-"}
                  />
                  <DetailRow
                    label="Tanggal"
                    value={formatTanggal(previewTx.tanggal)}
                  />
                  <DetailRow label="Jam" value={previewTx.jam || "-"} />

                  <DetailRow label="Nama Siswa" value={previewTx.nama} />
                  <DetailRow
                    label="Tipe Siswa"
                    value={previewTx.tipeSiswa || "-"}
                  />

                  <DetailRow
                    label="Jenis Pembayaran"
                    value={previewTx.jenisPembayaran || "-"}
                  />

                  <DetailRow label="Metode" value={previewTx.metode} />

                  <DetailRow
                    label="Nominal Awal"
                    value={`Rp ${(previewTx.nominalSebelumVoucher ?? 0).toLocaleString("id-ID")}`}
                  />

                  <DetailRow
                    label="Voucher Spin"
                    value={`Rp ${(previewTx.voucherSpin ?? 0).toLocaleString("id-ID")}`}
                  />

                  <DetailRow
                    label="Voucher Manual"
                    value={`Rp ${(previewTx.voucherManual ?? 0).toLocaleString("id-ID")}`}
                  />

                  <DetailRow
                    label="Total Voucher"
                    value={`Rp ${(previewTx.totalVoucher ?? 0).toLocaleString("id-ID")}`}
                  />

                  <DetailRow
                    label="Detail Voucher"
                    value={previewTx.detailVoucherSpin || "-"}
                  />

                  <DetailRow
                    label="Total Bayar"
                    value={`Rp ${(previewTx.totalBayar ?? 0).toLocaleString("id-ID")}`}
                    bold
                  />

                  <DetailRow label="Status" value={previewTx.status} bold />
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
      {/* <Modal visible={androidPicker !== null} transparent animationType="fade">
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
      </Modal> */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  proofWrap: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  proofImg: {
    width: "100%",
    maxWidth: 220,
    height: 220,
    borderRadius: 12,
  },

  detailCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 8,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  detailLabel: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 12,
  },

  detailValue: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 12,
  },

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
    color: "#0F172A",
    letterSpacing: 0.2,
    fontSize: 16,
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
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  cardTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  label: { marginTop: 12, fontWeight: "800", color: "#0F172A", fontSize: 12 },

  rangeRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  dateBtn: {
    marginTop: 6,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  dateText: { fontWeight: "900", color: "#0F172A", fontSize: 13 },

  applyBtn: {
    marginTop: 14,
    backgroundColor: "#3B82F6", // biru muda (blue-500)
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  applyText: {
    color: "white",
    fontWeight: "800",
    fontSize: 14,
  },

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
    alignSelf: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 6,
  },
  dayText: {
    fontWeight: "800",
    color: "#334155",
    fontSize: 12,
  },

  txItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  name: {
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 14,
  },

  sub: {
    marginTop: 4,
    color: "#64748B",
    fontWeight: "600",
    fontSize: 11,
  },

  money: {
    marginTop: 6,
    fontWeight: "900",
    color: "#020617",
    fontSize: 15,
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  badgeInfo: { backgroundColor: "#DBEAFE", borderColor: "#BFDBFE" },
  badgeWarn: { backgroundColor: "#FEF9C3", borderColor: "#FDE68A" },
  badgeText2: {
    fontWeight: "800",
    fontSize: 11,
    color: "#020617",
  },

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
  modalTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#020617",
  },

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
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
  previewMetaText: { color: "#0F172A", fontWeight: "700", lineHeight: 18 },
});
