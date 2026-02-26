// FILE: app/admin/siswa.tsx
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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
  TextInput,
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
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

type Student = {
  id: string;
  name: string;
  tipe: "Normal" | "Beasiswa 0" | "Beasiswa 100" | "Pertemuan (8x)";
  sppDefault: number;
  active: boolean; // ⬅️ TAMBAH INI
};

type PaidRow = {
  id: string; // payment doc id (invoiceNo)
  bulan: string; // contoh: "Januari 2026"
  tanggalBayar: string; // "11-01-2026"
  jamBayar: string; // "02:50"
  nominal: number;
  potonganSpin: number;
  dibayar: number;
  metode: "Cash" | "Transfer";

  // ✅ bukti bayar (BASE64 Data URL)
  proofDataUrl?: string | null;
  proofType?: "camera" | "gallery" | "upload" | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function bulanIndo(date: Date) {
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
  return `${bulan[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTanggal(d: Date) {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function formatJam(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function monthLabelFromMonthKey(monthKey: string) {
  // monthKey: YYYY-MM
  const [yStr, mStr] = String(monthKey || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return monthKey || "-";
  }
  const d = new Date(y, m - 1, 1);
  return bulanIndo(d);
}

// ===== FORMAT RUPIAH INPUT =====
function formatRupiahInput(value: string) {
  const number = value.replace(/\D/g, "");
  return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseRupiah(value: string) {
  return Number(value.replace(/\./g, "")) || 0;
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

export default function TabSiswa() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  // ✅ dari login admin
  const [branchId, setBranchId] = useState<string>("");
  const [branchName, setBranchName] = useState<string>("-");

  // ✅ siswa realtime dari Firestore
  const [siswa, setSiswa] = useState<Student[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(true);

  // ✅ mutasi pembayaran realtime
  const [history, setHistory] = useState<PaidRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ✅ siswa yang belum bayar bulan ini
  const [belumBayar, setBelumBayar] = useState<Student[]>([]);

  // ✅ siswa yang sudah bayar bulan ini
  const [sudahBayar, setSudahBayar] = useState<Student[]>([]);

  // ✅ filter tab
  const [filterMode, setFilterMode] = useState<"terbayar" | "belum">("belum");

  // ✅ modal preview bukti
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<PaidRow | null>(null);

  // ✅ STATE EDIT
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<PaidRow | null>(null);

  const [editNominal, setEditNominal] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editPotongan, setEditPotongan] = useState("");
  const [editMetode, setEditMetode] = useState<"Cash" | "Transfer">("Cash");
  const [editTanggal, setEditTanggal] = useState("");
  const [editJam, setEditJam] = useState("");
  const [editBulan, setEditBulan] = useState("");

  function openPreview(item: PaidRow) {
    if (!item.proofDataUrl) return;
    setPreviewItem(item);
    setPreviewOpen(true);
  }
  function closePreview() {
    setPreviewOpen(false);
    setPreviewItem(null);
  }
  function openEdit(item: PaidRow) {
    setEditItem(item);
    setEditNominal(formatRupiahInput(String(item.nominal)));
    setEditPotongan(String(item.potonganSpin));
    setEditMetode(item.metode);

    setEditTanggal(item.tanggalBayar);
    setEditJam(item.jamBayar);
    setEditBulan(item.bulan);

    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditItem(null);
  }

  async function handleSaveEdit() {
    if (!editItem) return;

    if (!editTanggal || !editJam) {
      Alert.alert("Error", "Tanggal atau jam tidak valid");
      return;
    }

    try {
      const nominal = parseRupiah(editNominal);
      const potongan = parseRupiah(editPotongan);
      const totalFinal = Math.max(nominal - potongan, 0);

      // Convert tanggal + jam ke Date
      const [dd, mm, yyyy] = editTanggal.split("-");
      const [hh, min] = editJam.split(":");

      const newDate = new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(min),
      );

      // Convert bulan ke monthKey (YYYY-MM)
      let newMonthKey = "";
      try {
        const parts = editBulan.split(" ");
        const monthName = parts[0];
        const year = parts[1];

        const bulanList = [
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

        const monthIndex = bulanList.indexOf(monthName) + 1;

        if (monthIndex > 0) {
          newMonthKey = `${year}-${String(monthIndex).padStart(2, "0")}`;
        }
      } catch {}

      // UPDATE FIRESTORE FULL
      await updateDoc(doc(db, "payments", editItem.id), {
        nominal,
        potongan,
        total: totalFinal,
        totalBayar: totalFinal,
        metode: editMetode,
        paidAt: newDate,
        monthKey: newMonthKey || null,
      });

      // 2️⃣ KIRIM KE SPREADSHEET (UPSERT)
      const response = await fetch(
        "https://script.google.com/macros/s/AKfycbwIaJbNqSf2rWOkWQMeUTlUwlP-5ox5czeR3W2SM359lCegX7eLeC-BJl2IsmAdN3tqkg/exec",
        {
          method: "POST",
          redirect: "follow",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentId: editItem.id,
            branchName: branchName,
            tanggal: editTanggal,
            jam: editJam,
            jenisPembayaran: editBulan,
            studentName: selected?.name,
            studentType: selected?.tipe,

            metode: editMetode,
            nominalSebelumVoucher: nominal,
            voucherSpin: potongan,
            voucherManual: 0,
            totalVoucher: potongan,
            voucherSpinDetail: "-",
            totalDibayar: totalFinal,
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      Alert.alert("Berhasil", "Pembayaran berhasil diperbarui");
      closeEdit();
    } catch (e: any) {
      Alert.alert("Gagal", e?.message || "Gagal update pembayaran");
    }
  }

  // ===================== Ambil branchId dari users/{uid} =====================
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const u = auth.currentUser;
        if (!u) {
          if (mounted) router.replace("/login");
          return;
        }

        const uSnap = await getDoc(doc(db, "users", u.uid));
        if (!uSnap.exists()) {
          Alert.alert("Gagal", "Data akun tidak ditemukan.");
          if (mounted) router.replace("/login");
          return;
        }

        const data = uSnap.data() as any;
        if (data.active === false) {
          Alert.alert("Akun Nonaktif", "Akun kamu sedang dinonaktifkan.");
          if (mounted) router.replace("/login");
          return;
        }

        // ✅ samakan seperti Bayar SPP: prioritas cabangId dulu
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

        if (mounted) setBranchId(bid);

        const bSnap = await getDoc(doc(db, "branches", bid));
        if (mounted) {
          if (bSnap.exists()) {
            const b = bSnap.data() as any;
            setBranchName(String(b.name || b.branchName || "-").trim() || "-");
          } else {
            setBranchName(
              String(data.branchName || data.cabangName || "-") || "-",
            );
          }
        }
      } catch (e: any) {
        console.log(e);
        Alert.alert("Gagal", e?.message || "Tidak bisa memuat profil admin.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // ===================== Load siswa berdasarkan branchId login =====================
  useEffect(() => {
    if (!branchId) {
      setSiswa([]);
      setLoadingSiswa(false);
      return;
    }

    setLoadingSiswa(true);

    const qRef = query(
      collection(db, "students"),
      where("branchId", "==", branchId),

      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Student[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const type = String(data.type || data.tipe || "Normal");

          const tipe: Student["tipe"] =
            type === "Pertemuan"
              ? "Pertemuan (8x)"
              : type === "Beasiswa 0"
                ? "Beasiswa 0"
                : type === "Beasiswa 100"
                  ? "Beasiswa 100"
                  : "Normal";

          return {
            id: d.id,
            name: String(data.name || data.nama || "").trim(),
            tipe,
            sppDefault: Number(data.sppDefault ?? data.spp ?? 0) || 0,
            active: data.active !== false, // ⬅️ penting
          };
        });

        const activeRows = rows.filter((s) => s.active);
        setSiswa(activeRows);

        setLoadingSiswa(false);

        // amankan selected kalau data berubah
        setSelected((prev) => {
          if (!prev) return prev;
          const found = rows.find((x) => x.id === prev.id);
          return found || null;
        });
      },
      (err) => {
        console.log("students query error:", err?.code, err?.message);
        setLoadingSiswa(false);
      },
    );

    return () => unsub();
  }, [branchId]);

  // ===================== Load mutasi pembayaran saat pilih siswa =====================
  useEffect(() => {
    setHistory([]);
    if (!branchId || !selected?.id) return;

    setLoadingHistory(true);

    // ✅ butuh composite index: payments(branchId asc, studentId asc, paidAt desc)
    const qPay = query(
      collection(db, "payments"),
      where("branchId", "==", branchId),
      where("studentId", "==", selected.id),
      orderBy("paidAt", "desc"),
      limit(36),
    );

    const unsub = onSnapshot(
      qPay,
      (snap) => {
        const rows: PaidRow[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const paidAt: Date | null = data?.paidAt?.toDate
            ? data.paidAt.toDate()
            : data?.paidAt instanceof Timestamp
              ? data.paidAt.toDate()
              : null;

          const monthKey = String(data.monthKey || "");
          const bulan = monthKey ? monthLabelFromMonthKey(monthKey) : "-";

          const nominal = Number(data.nominal || 0) || 0;
          const potongan = Number(data.potongan || 0) || 0;
          const total =
            Number(data.total || 0) || Math.max(nominal - potongan, 0);

          const invoiceNo = String(data.invoiceNo || d.id);

          return {
            id: d.id,
            invoiceNo: String(data.invoiceNo || d.id),
            bulan,
            tanggalBayar: paidAt ? formatTanggal(paidAt) : "-",
            jamBayar: paidAt ? formatJam(paidAt) : "-",
            nominal,
            potonganSpin: potongan,
            dibayar: total,
            metode: (data.metode as "Cash" | "Transfer") || "Cash",
            proofDataUrl: data.proofDataUrl || null,
            proofType: (data.proofType as any) || null,
          };
        });

        setHistory(rows);
        setLoadingHistory(false);
      },
      (err) => {
        // ✅ FIX: jangan munculkan alert index / popup apa pun.
        console.log("mutasi payments error:", err?.code, err?.message);
        setLoadingHistory(false);
      },
    );

    return () => unsub();
  }, [branchId, selected?.id]);

  // ===================== Hitung siapa yang belum bayar bulan ini =====================
  useEffect(() => {
    if (!branchId || siswa.length === 0) {
      setBelumBayar([]);
      setSudahBayar([]);
      return;
    }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

    const qPay = query(
      collection(db, "payments"),
      where("branchId", "==", branchId),
      where("monthKey", "==", currentMonthKey),
    );

    const unsub = onSnapshot(qPay, (snap) => {
      const paidIds = new Set<string>();

      snap.docs.forEach((d) => {
        const data = d.data() as any;
        if (data.studentId) {
          paidIds.add(String(data.studentId));
        }
      });

      const sudah = siswa.filter((s) => paidIds.has(s.id));

      const belum = siswa.filter((s) => !paidIds.has(s.id));

      setSudahBayar(sudah);
      setBelumBayar(belum);
    });

    return () => unsub();
  }, [branchId, siswa]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return siswa;
    return siswa.filter((x) => x.name.toLowerCase().includes(qq));
  }, [q, siswa]);

  // ✅ SAMAKAN JARAK seperti Bayar SPP:
  // - topPad: aman dari notch/status bar + tetap konsisten
  // - bottomPad: aman dari tabbar (pakai tabH saja biar gak double)
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
          {
            paddingTop: topPad,
            paddingBottom: bottomPad,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Shining Sun 🎈</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{branchName}</Text>
          </View>
        </View>

        <Text style={styles.title}>Siswa</Text>
        <Text style={styles.subtitle}>
          Cabang: <Text style={styles.bold}>{branchName}</Text> • Klik nama
          siswa untuk melihat <Text style={styles.bold}>mutasi pembayaran</Text>
          .
        </Text>

        {/* === LIST SISWA === */}
        {!selected ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cari Siswa 🧸</Text>

            <View style={styles.inputWrap}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Ketik nama siswa..."
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
              <View style={styles.rightIcon}>
                <Ionicons name="search-outline" size={18} color="#64748B" />
              </View>
            </View>
            {/* ===== TAB TERBAYAR / BELUM ===== */}
            <View style={styles.segmentWrap}>
              <TouchableOpacity
                onPress={() => setFilterMode("terbayar")}
                style={[
                  styles.segmentBtn,
                  filterMode === "terbayar" && styles.segmentActiveBlue,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    filterMode === "terbayar" && styles.segmentTextActive,
                  ]}
                >
                  Terbayar ({sudahBayar.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFilterMode("belum")}
                style={[
                  styles.segmentBtn,
                  filterMode === "belum" && styles.segmentActiveRed,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    filterMode === "belum" && styles.segmentTextActive,
                  ]}
                >
                  Belum ({belumBayar.length})
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 12, gap: 10 }}>
              {loadingSiswa ? (
                <View style={{ paddingVertical: 10, alignItems: "center" }}>
                  <ActivityIndicator />
                  <Text style={[styles.note, { marginTop: 10 }]}>
                    Memuat siswa...
                  </Text>
                </View>
              ) : (
                (() => {
                  const baseData =
                    filterMode === "terbayar" ? sudahBayar : belumBayar;

                  const qq = q.trim().toLowerCase();

                  const dataToShow = !qq
                    ? baseData
                    : baseData.filter((s) => s.name.toLowerCase().includes(qq));

                  if (dataToShow.length === 0) {
                    return (
                      <Text style={styles.empty}>
                        Tidak ada data untuk kategori ini.
                      </Text>
                    );
                  }

                  return dataToShow.slice(0, 50).map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      activeOpacity={0.9}
                      onPress={() => setSelected(s)}
                      style={styles.studentItem}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>{s.name}</Text>
                        <Text style={styles.studentSub}>
                          {s.tipe} • Rp {s.sppDefault.toLocaleString("id-ID")}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={22}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>
                  ));
                })()
              )}
            </View>

            <Text style={styles.note}>
              * List siswa otomatis mengikuti cabang akun admin yang login.
            </Text>
          </View>
        ) : (
          /* === DETAIL MUTASI PEMBAYARAN (REAL) === */
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Mutasi Pembayaran</Text>
              <View style={styles.badgeInfo}>
                <Text style={styles.badgeText}>{selected.tipe}</Text>
              </View>
            </View>

            <Text style={styles.bigName}>{selected.name}</Text>
            <Text style={styles.miniSub}>
              Berikut riwayat pembayaran yang sudah{" "}
              <Text style={{ fontWeight: "900" }}>LUNAS</Text>.
            </Text>

            <View style={styles.hr} />

            {loadingHistory ? (
              <View style={{ paddingVertical: 10, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={[styles.note, { marginTop: 10 }]}>
                  Memuat mutasi pembayaran...
                </Text>
              </View>
            ) : history.length === 0 ? (
              <Text style={styles.empty}>
                Belum ada pembayaran tersimpan untuk siswa ini.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {history.map((m) => {
                  const hasProof = !!m.proofDataUrl;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      activeOpacity={0.9}
                      onPress={() => (hasProof ? openPreview(m) : null)}
                      style={styles.mutasiItem}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={styles.mutasiBulan}>{m.bulan}</Text>

                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <View style={[styles.badge, styles.badgeOk]}>
                            <Text style={styles.badgeText2}>Lunas</Text>
                          </View>

                          {hasProof ? (
                            <Image
                              source={{ uri: m.proofDataUrl as string }}
                              style={styles.thumb}
                            />
                          ) : (
                            <View style={styles.thumbEmpty}>
                              <Ionicons
                                name="image-outline"
                                size={16}
                                color="#94A3B8"
                              />
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.mutasiRow}>
                        <Text style={styles.meta}>Nominal</Text>
                        <Text style={styles.meta2}>
                          Rp {m.nominal.toLocaleString("id-ID")}
                        </Text>
                      </View>

                      <View style={styles.mutasiRow}>
                        <Text style={styles.meta}>Potongan (Spin)</Text>
                        <Text style={styles.meta2}>
                          Rp {m.potonganSpin.toLocaleString("id-ID")}
                        </Text>
                      </View>

                      <View style={styles.mutasiRow}>
                        <Text style={styles.meta}>Dibayar</Text>
                        <Text style={styles.money}>
                          Rp {m.dibayar.toLocaleString("id-ID")}
                        </Text>
                      </View>

                      <View style={styles.mutasiRow}>
                        <Text style={styles.meta}>Tanggal Bayar</Text>
                        <Text style={styles.meta2}>
                          {m.tanggalBayar}{" "}
                          {m.jamBayar !== "-" ? `• ${m.jamBayar}` : ""}
                        </Text>
                      </View>

                      <View style={styles.mutasiRow}>
                        <Text style={styles.meta}>Metode</Text>
                        <Text style={styles.meta2}>{m.metode}</Text>
                      </View>

                      {hasProof && (
                        <Text style={styles.proofHint}>
                          * Tap untuk lihat bukti pembayaran
                        </Text>
                      )}

                      <TouchableOpacity
                        onPress={() => openEdit(m)}
                        style={{
                          marginTop: 10,
                          backgroundColor: "#DBEAFE",
                          paddingVertical: 6,
                          borderRadius: 10,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontWeight: "800", color: "#1E40AF" }}>
                          Edit Pembayaran
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.secondaryBtn}
              onPress={() => setSelected(null)}
            >
              <Ionicons name="arrow-back" size={18} color="#0F172A" />
              <Text style={styles.secondaryText}>Kembali ke daftar siswa</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              * Mutasi diambil realtime dari koleksi{" "}
              <Text style={{ fontWeight: "900" }}>payments</Text>.
            </Text>
          </View>
        )}

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

            {!previewItem?.proofDataUrl ? (
              <Text style={[styles.note, { marginTop: 12 }]}>
                Tidak ada bukti.
              </Text>
            ) : (
              <>
                <>
                  {/* Thumbnail bukti */}
                  <View style={styles.proofWrap}>
                    <Image
                      source={{ uri: previewItem.proofDataUrl }}
                      style={styles.proofImg}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Detail pembayaran */}
                  <View style={styles.detailCard}>
                    <DetailRow label="Nama" value={selected?.name || "-"} />
                    <DetailRow label="Periode" value={previewItem.bulan} />
                    <DetailRow
                      label="Tanggal"
                      value={`${previewItem.tanggalBayar}${
                        previewItem.jamBayar !== "-"
                          ? ` • ${previewItem.jamBayar}`
                          : ""
                      }`}
                    />
                    <DetailRow label="Metode" value={previewItem.metode} />
                    <DetailRow
                      label="Nominal"
                      value={`Rp ${previewItem.nominal.toLocaleString("id-ID")}`}
                    />
                    <DetailRow
                      label="Potongan"
                      value={`Rp ${previewItem.potonganSpin.toLocaleString("id-ID")}`}
                    />
                    <DetailRow
                      label="Dibayar"
                      value={`Rp ${previewItem.dibayar.toLocaleString("id-ID")}`}
                      bold
                    />
                  </View>
                </>
              </>
            )}
          </View>
        </View>
      </Modal>
      <Modal visible={editOpen} transparent animationType="fade">
        <View style={styles.previewBackdrop}>
          <View style={styles.editCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Edit Pembayaran</Text>
              <TouchableOpacity onPress={closeEdit} style={styles.xBtn}>
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* PERIODE */}
            <Text style={styles.editLabel}>Periode</Text>
            <View style={styles.editBox}>
              <Text style={styles.editValue}>{editBulan}</Text>
            </View>

            {/* NOMINAL */}
            <Text style={styles.editLabel}>Nominal</Text>
            <View style={styles.rpInputWrap}>
              <Text style={styles.rpPrefix}>Rp</Text>
              <TextInput
                value={editNominal}
                onChangeText={(text) => setEditNominal(formatRupiahInput(text))}
                keyboardType="numeric"
                style={styles.rpInput}
              />
            </View>

            {/* POTONGAN */}
            <Text style={styles.editLabel}>Potongan</Text>
            <View style={styles.rpInputWrap}>
              <Text style={styles.rpPrefix}>Rp</Text>
              <TextInput
                value={editPotongan}
                onChangeText={(text) =>
                  setEditPotongan(formatRupiahInput(text))
                }
                keyboardType="numeric"
                style={styles.rpInput}
              />
            </View>

            {/* TANGGAL */}
            <Text style={styles.editLabel}>Tanggal</Text>
            <TouchableOpacity
              style={styles.editBox}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.editValue}>{editTanggal}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={
                  editTanggal
                    ? (() => {
                        const [dd, mm, yyyy] = editTanggal.split("-");
                        return new Date(
                          Number(yyyy),
                          Number(mm) - 1,
                          Number(dd),
                        );
                      })()
                    : new Date()
                }
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    setEditTanggal(formatTanggal(date));
                    setEditJam(formatJam(date));
                  }
                }}
              />
            )}

            {/* METODE */}
            <Text style={styles.editLabel}>Metode</Text>
            <View style={styles.segmentWrap}>
              <TouchableOpacity
                onPress={() => setEditMetode("Cash")}
                style={[
                  styles.segmentBtn,
                  editMetode === "Cash" && styles.segmentActiveBlue,
                ]}
              >
                <Text style={styles.segmentText}>Cash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setEditMetode("Transfer")}
                style={[
                  styles.segmentBtn,
                  editMetode === "Transfer" && styles.segmentActiveBlue,
                ]}
              >
                <Text style={styles.segmentText}>Transfer</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleSaveEdit}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryText}>Simpan Perubahan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    maxWidth: "60%",
  },
  chipText: { color: "#1E40AF", fontWeight: "900", fontSize: 12 },

  title: { fontSize: 26, fontWeight: "900", color: "#0F172A", marginTop: 2 },
  subtitle: {
    color: "#64748B",
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  bold: { fontWeight: "900", color: "#0F172A" },

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

  inputWrap: {
    marginTop: 12,
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 42,
    height: 48,
    justifyContent: "center",
  },
  input: { fontSize: 14, color: "#0F172A", fontWeight: "700" },
  rightIcon: {
    position: "absolute",
    right: 12,
    height: 48,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  studentItem: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  studentName: { fontWeight: "900", color: "#0F172A", fontSize: 15 },
  studentSub: { marginTop: 4, color: "#64748B", fontWeight: "700" },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  bigName: {
    marginTop: 10,
    fontWeight: "900",
    color: "#0F172A",
    fontSize: 18,
  },
  miniSub: {
    marginTop: 6,
    color: "#64748B",
    fontWeight: "700",
    lineHeight: 18,
  },

  hr: {
    height: 1,
    backgroundColor: "rgba(226,232,240,0.95)",
    marginTop: 12,
    marginBottom: 12,
  },

  mutasiItem: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 12,
  },
  mutasiBulan: { fontWeight: "900", color: "#0F172A" },
  mutasiRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  meta: { color: "#64748B", fontWeight: "700", fontSize: 12 },
  meta2: { color: "#0F172A", fontWeight: "900", fontSize: 12 },
  money: { color: "#0F172A", fontWeight: "900", fontSize: 12 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  badgeText2: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

  badgeInfo: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  thumbEmpty: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  proofHint: {
    marginTop: 10,
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "left",
  },

  secondaryBtn: {
    marginTop: 14,
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

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
  },

  empty: { color: "#64748B", fontWeight: "700", fontSize: 12 },

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
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  xBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
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
  segmentWrap: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },

  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },

  segmentActiveBlue: {
    backgroundColor: "#DBEAFE",
  },

  segmentActiveRed: {
    backgroundColor: "#FEE2E2",
  },

  segmentText: {
    fontWeight: "800",
    color: "#475569",
  },

  segmentTextActive: {
    color: "#0F172A",
  },
  editCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    gap: 10,
  },

  editLabel: {
    marginTop: 6,
    fontWeight: "800",
    color: "#475569",
    fontSize: 12,
  },

  editBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  editValue: {
    fontWeight: "900",
    color: "#0F172A",
  },

  rpInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
  },

  rpPrefix: {
    fontWeight: "900",
    marginRight: 6,
    color: "#0F172A",
  },

  rpInput: {
    flex: 1,
    paddingVertical: 12,
    fontWeight: "900",
    color: "#0F172A",
  },

  primaryBtn: {
    marginTop: 16,
    backgroundColor: "#16A34A",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },

  primaryText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  previewMetaText: { color: "#0F172A", fontWeight: "700", lineHeight: 18 },
});
