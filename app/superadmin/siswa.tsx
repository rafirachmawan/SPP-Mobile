// FILE: app/superadmin/siswa.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Pressable,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// ✅ Firebase
import { db } from "../../firebase"; // ✅ sesuaikan path
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  Timestamp,
} from "firebase/firestore";

type Cabang = { id: string; nama: string };

type Student = {
  id: string;
  name: string;
  cabangId: string;
  cabangNama: string; // hasil join dari branches
  tipe: string;
  spp: number;
};

type PaidRow = {
  id: string;
  bulan: string;
  tanggal: string;
  jam: string;
  nominal: number;
  potongan: number;
  dibayar: number;
  metode: "Cash" | "Transfer";

  // ✅ bukti bayar (ikuti yang dipakai Bayar SPP)
  proofDataUrl?: string | null;
  proofType?: "camera" | "gallery" | "upload" | null;
};

// 🎨 Font Map (Inter)
const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatTanggal(d: Date) {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function formatJam(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
function monthLabelFromMonthKey(monthKey: string) {
  // monthKey: YYYY-MM
  const [yStr, mStr] = String(monthKey || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12)
    return monthKey || "-";
  return bulanIndo(new Date(y, m - 1, 1));
}

export default function SiswaByCabangPage() {
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  // ====== CABANG dari Firestore (branches) ======
  const [cabangRows, setCabangRows] = useState<Cabang[]>([]);
  const [loadingCabang, setLoadingCabang] = useState(true);

  // ====== SISWA dari Firestore (students) ======
  const [siswaAll, setSiswaAll] = useState<Student[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(true);

  // ====== MUTASI dari Firestore (payments) ======
  const [history, setHistory] = useState<PaidRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [cabang, setCabang] = useState<string>("Semua"); // "Semua" atau cabangId
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  // ✅ modal preview bukti
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<PaidRow | null>(null);

  // ✅ dropdown cabang (baru)
  const [cabangPickerOpen, setCabangPickerOpen] = useState(false);
  const [cabangPickerSearch, setCabangPickerSearch] = useState("");

  function openPreview(item: PaidRow) {
    if (!item.proofDataUrl) return;
    setPreviewItem(item);
    setPreviewOpen(true);
  }
  function closePreview() {
    setPreviewOpen(false);
    setPreviewItem(null);
  }

  // ===================== LOAD CABANG (branches) =====================
  useEffect(() => {
    setLoadingCabang(true);
    const qRef = query(collection(db, "branches"), orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Cabang[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            nama: String(data.name || data.branchName || "").trim(),
          };
        });
        setCabangRows(rows);
        setLoadingCabang(false);
      },
      (err) => {
        console.log(err);
        setLoadingCabang(false);
        Alert.alert("Gagal", "Tidak bisa mengambil data cabang.");
      }
    );

    return () => unsub();
  }, []);

  // cabangList utk filter (Semua + hasil branches)
  const cabangList = useMemo(() => {
    const base = [{ id: "Semua", nama: "Semua" }];
    return base.concat(cabangRows);
  }, [cabangRows]);

  // helper nama cabang dari id
  const cabangNameById = useMemo(() => {
    const map = new Map<string, string>();
    cabangRows.forEach((c) => map.set(c.id, c.nama));
    return (id: string) => map.get(id) || "-";
  }, [cabangRows]);

  const cabangLabel = useMemo(() => {
    if (cabang === "Semua") return "Semua";
    return cabangNameById(cabang);
  }, [cabang, cabangNameById]);

  const cabangFiltered = useMemo(() => {
    const qq = cabangPickerSearch.trim().toLowerCase();
    if (!qq) return cabangList;
    return cabangList.filter((x) => x.nama.toLowerCase().includes(qq));
  }, [cabangList, cabangPickerSearch]);

  // ===================== LOAD SISWA (students) =====================
  useEffect(() => {
    setLoadingSiswa(true);

    const qRef = query(collection(db, "students"), orderBy("name", "asc"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Student[] = snap.docs.map((d) => {
          const data = d.data() as any;

          const cabangId = String(data.cabangId || data.branchId || "").trim();
          const name = String(data.name || data.nama || "").trim();

          const tipe = String(data.tipe || data.type || "Normal");
          const spp =
            Number(data.sppDefault ?? data.spp ?? data.nominalSpp ?? 0) || 0;

          return {
            id: d.id,
            name,
            cabangId,
            cabangNama: cabangId ? cabangNameById(cabangId) : "-",
            tipe,
            spp,
          };
        });

        const fixed = rows.map((r) => ({
          ...r,
          cabangNama: r.cabangId ? cabangNameById(r.cabangId) : "-",
        }));

        setSiswaAll(fixed);
        setLoadingSiswa(false);

        // amankan selected kalau data berubah
        setSelected((prev) => {
          if (!prev) return prev;
          const found = fixed.find((x) => x.id === prev.id);
          return found || null;
        });
      },
      (err) => {
        console.log(err);
        setLoadingSiswa(false);
        Alert.alert("Gagal", "Tidak bisa mengambil data siswa.");
      }
    );

    return () => unsub();
  }, [cabangNameById]);

  // ===== list siswa sesuai filter cabang + search =====
  const list = useMemo(() => {
    let base = siswaAll;

    if (cabang !== "Semua") {
      base = base.filter((x) => x.cabangId === cabang);
    }

    const qq = q.trim().toLowerCase();
    if (!qq) return base;

    return base.filter((x) => x.name.toLowerCase().includes(qq));
  }, [siswaAll, cabang, q]);

  // ===================== LOAD MUTASI (payments) saat pilih siswa =====================
  useEffect(() => {
    setHistory([]);
    if (!selected?.id) return;

    setLoadingHistory(true);

    const baseCol = collection(db, "payments");

    const qPay =
      cabang === "Semua"
        ? query(
            baseCol,
            where("studentId", "==", selected.id),
            orderBy("paidAt", "desc"),
            limit(60)
          )
        : query(
            baseCol,
            where("studentId", "==", selected.id),
            where("branchId", "==", cabang),
            orderBy("paidAt", "desc"),
            limit(60)
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
          const bulan =
            String(data.monthLabel || "").trim() ||
            (monthKey
              ? monthLabelFromMonthKey(monthKey)
              : paidAt
              ? bulanIndo(paidAt)
              : "-");

          const nominal = Number(data.nominal || 0) || 0;
          const potongan = Number(data.potongan || 0) || 0;
          const total =
            Number(data.total || 0) || Math.max(nominal - potongan, 0);

          const metode: "Cash" | "Transfer" =
            String(data.metode || "Cash") === "Transfer" ? "Transfer" : "Cash";

          return {
            id: d.id,
            bulan,
            tanggal: paidAt ? formatTanggal(paidAt) : "-",
            jam: paidAt ? formatJam(paidAt) : "-",
            nominal,
            potongan,
            dibayar: total,
            metode,

            proofDataUrl: data.proofDataUrl || null,
            proofType: (data.proofType as any) || null,
          };
        });

        setHistory(rows);
        setLoadingHistory(false);
      },
      (err: any) => {
        console.log("mutasi superadmin error:", err?.code, err?.message);
        setLoadingHistory(false);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, cabang]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ✅ MODAL DROPDOWN CABANG (tanpa ID) */}
      <Modal
        visible={cabangPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCabangPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCabangPickerOpen(false)}
        />
        <View
          style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pilih Cabang</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setCabangPickerOpen(false)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchWrap}>
            <Ionicons name="search-outline" size={18} color="#64748B" />
            <TextInput
              value={cabangPickerSearch}
              onChangeText={setCabangPickerSearch}
              placeholder="Cari cabang..."
              placeholderTextColor="#94A3B8"
              style={styles.modalSearchInput}
              autoCorrect={false}
            />
          </View>

          <ScrollView
            style={{ marginTop: 10, maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loadingCabang ? (
              <Text style={styles.note}>Memuat cabang...</Text>
            ) : cabangList.length <= 1 ? (
              <Text style={[styles.note, { color: "#ef4444" }]}>
                Belum ada cabang. Tambah cabang dulu.
              </Text>
            ) : cabangFiltered.length === 0 ? (
              <Text style={styles.note}>Cabang tidak ditemukan.</Text>
            ) : (
              cabangFiltered.map((c) => {
                const active = c.id === cabang;
                return (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.9}
                    style={[
                      styles.pickRow,
                      active && {
                        backgroundColor: "#DBEAFE",
                        borderColor: "#BFDBFE",
                      },
                    ]}
                    onPress={() => {
                      setCabang(c.id);
                      setSelected(null);
                      setHistory([]);
                      setCabangPickerOpen(false);
                      setCabangPickerSearch("");
                    }}
                  >
                    <Text
                      style={[
                        styles.pickRowText,
                        active && { color: "#0F172A" },
                      ]}
                    >
                      {c.nama}
                    </Text>

                    {active ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#16A34A"
                      />
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#94A3B8"
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <Text style={[styles.note, { marginTop: 10 }]}>
            Tip: ketik nama cabang biar cepat.
          </Text>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 14),
            paddingBottom: tabH + insets.bottom + 18,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Siswa per Cabang"
          subtitle="Pilih cabang, lalu klik siswa untuk lihat mutasi."
        />

        {/* Filter cabang */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filter Cabang</Text>

          {loadingCabang ? (
            <Text style={[styles.note, { marginTop: 10 }]}>
              Memuat cabang...
            </Text>
          ) : cabangList.length <= 1 ? (
            <Text style={[styles.note, { marginTop: 10 }]}>
              Belum ada cabang. Tambah cabang dulu di fitur Tambah Cabang.
            </Text>
          ) : (
            <>
              {/* ✅ dropdown cabang (tanpa ID) */}
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.selectBox}
                onPress={() => setCabangPickerOpen(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectLabel}>Cabang Terpilih</Text>
                  <Text style={styles.selectValue}>{cabangLabel}</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </>
          )}

          <View style={styles.inputWrap}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Cari nama siswa..."
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <View style={styles.rightIcon}>
              <Ionicons name="search-outline" size={18} color="#64748B" />
            </View>
          </View>
        </View>

        {/* List / Detail */}
        {!selected ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Daftar Siswa</Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              {loadingSiswa ? (
                <Text style={styles.note}>Memuat siswa...</Text>
              ) : list.length === 0 ? (
                <Text style={styles.note}>
                  Tidak ada siswa untuk filter ini.
                </Text>
              ) : (
                list.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    activeOpacity={0.9}
                    style={styles.item}
                    onPress={() => setSelected(s)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{s.name}</Text>
                      <Text style={styles.itemSub}>
                        {s.cabangNama} • {s.tipe} • Rp{" "}
                        {s.spp.toLocaleString("id-ID")}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={22}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                ))
              )}
            </View>

            <Text style={styles.note}>
              Klik siswa untuk lihat mutasi pembayaran (realtime).
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Mutasi Pembayaran</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Lunas</Text>
              </View>
            </View>

            <Text style={styles.bigName}>{selected.name}</Text>
            <Text style={styles.meta}>
              {selected.cabangNama} • {selected.tipe} • SPP Rp{" "}
              {selected.spp.toLocaleString("id-ID")}
            </Text>

            <View style={styles.hr} />

            {loadingHistory ? (
              <View style={{ paddingVertical: 10, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={[styles.note, { marginTop: 10 }]}>
                  Memuat mutasi...
                </Text>
              </View>
            ) : history.length === 0 ? (
              <Text style={[styles.note, { marginTop: 4 }]}>
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
                        <Text style={styles.mutasiTanggal}>
                          {m.tanggal}
                          {m.jam !== "-" ? ` • ${m.jam}` : ""}
                        </Text>
                      </View>

                      <View style={styles.mutasiRow}>
                        <Text style={styles.k}>Nominal</Text>
                        <Text style={styles.v}>
                          Rp {m.nominal.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <View style={styles.mutasiRow}>
                        <Text style={styles.k}>Potongan Spin</Text>
                        <Text style={styles.v}>
                          Rp {m.potongan.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <View style={styles.mutasiRow}>
                        <Text style={styles.k}>Dibayar</Text>
                        <Text style={styles.vStrong}>
                          Rp {m.dibayar.toLocaleString("id-ID")}
                        </Text>
                      </View>
                      <View style={styles.mutasiRow}>
                        <Text style={styles.k}>Metode</Text>
                        <Text style={styles.v}>{m.metode}</Text>
                      </View>

                      <View
                        style={{
                          marginTop: 10,
                          flexDirection: "row",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        {hasProof ? (
                          <>
                            <Image
                              source={{ uri: m.proofDataUrl as string }}
                              style={styles.thumb}
                            />
                            <Text style={styles.proofHint}>
                              Tap untuk lihat bukti
                            </Text>
                          </>
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
            )}

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.backBtn}
              onPress={() => {
                setSelected(null);
                setHistory([]);
              }}
            >
              <Ionicons name="arrow-back" size={18} color="#0F172A" />
              <Text style={styles.backText}>Kembali</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              * Data mutasi diambil realtime dari koleksi payments.
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
                <View style={{ marginTop: 12 }}>
                  <Image
                    source={{ uri: previewItem.proofDataUrl }}
                    style={styles.previewImg}
                  />
                </View>

                <View style={styles.previewMeta}>
                  <Text style={styles.previewMetaText}>
                    <Text style={{ fontFamily: F.extrabold }}>
                      {selected?.name || "-"}
                    </Text>
                    {"\n"}
                    {previewItem.bulan} • {previewItem.metode}
                    {"\n"}
                    {previewItem.tanggal}
                    {previewItem.jam !== "-" ? ` • ${previewItem.jam}` : ""}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.brand}>SPP Mobile</Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Master</Text>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

// ✅ styles kamu biarkan sama persis + tambah style dropdown/modal (tidak mengubah yang lain)
const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, gap: 12 },

  header: {
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontFamily: F.extrabold, color: "#1D4ED8", letterSpacing: 0.3 },
  chip: {
    backgroundColor: "rgba(219,234,254,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
  },
  chipText: { color: "#1E40AF", fontFamily: F.extrabold, fontSize: 12 },

  title: {
    fontSize: 26,
    fontFamily: F.extrabold,
    color: "#0F172A",
    marginTop: 10,
  },
  subtitle: {
    color: "#64748B",
    lineHeight: 20,
    fontFamily: F.semibold,
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
  cardTitle: { fontSize: 16, fontFamily: F.extrabold, color: "#0F172A" },

  // ✅ dropdown select box
  selectBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectLabel: {
    fontFamily: F.semibold,
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 2,
  },
  selectValue: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 14 },

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
  input: { fontSize: 14, color: "#0F172A", fontFamily: F.semibold },
  rightIcon: {
    position: "absolute",
    right: 12,
    height: 48,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  item: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  itemTitle: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 15 },
  itemSub: { marginTop: 4, color: "#64748B", fontFamily: F.semibold },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  badge: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontFamily: F.extrabold, fontSize: 12, color: "#0F172A" },

  bigName: {
    marginTop: 10,
    fontFamily: F.extrabold,
    color: "#0F172A",
    fontSize: 18,
  },
  meta: { marginTop: 6, color: "#64748B", fontFamily: F.bold },

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
  mutasiBulan: { fontFamily: F.extrabold, color: "#0F172A" },
  mutasiTanggal: { fontFamily: F.bold, color: "#94A3B8" },
  mutasiRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  k: { color: "#64748B", fontFamily: F.bold },
  v: { color: "#0F172A", fontFamily: F.extrabold },
  vStrong: { color: "#0F172A", fontFamily: F.extrabold },

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
  proofHint: { color: "#94A3B8", fontFamily: F.bold },

  backBtn: {
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
  backText: { color: "#0F172A", fontFamily: F.extrabold },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontFamily: F.semibold,
    fontSize: 12,
  },

  // ✅ modal dropdown
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.35)",
  },
  modalSheet: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 120,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 16, fontFamily: F.extrabold, color: "#0F172A" },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 46,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontFamily: F.semibold,
  },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  pickRowText: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 14 },

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
  modalTitle2: { fontSize: 16, fontFamily: F.extrabold, color: "#0F172A" },
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
  previewMetaText: { color: "#0F172A", fontFamily: F.bold, lineHeight: 18 },

  // // keep old key used in preview header
  // modalTitle: { fontSize: 16, fontFamily: F.extrabold, color: "#0F172A" },
});
