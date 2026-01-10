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
  bulan: string;
  tanggal: string;
  nominal: number;
  potongan: number;
  dibayar: number;
  status: "Lunas";
};

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

function genHistoryDummy(spp: number) {
  const now = new Date();
  const rows: PaidRow[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const pot = i % 3 === 0 ? 10000 : 0;
    const pay = Math.max(spp - pot, 0);
    rows.push({
      bulan: bulanIndo(d),
      tanggal: `0${(i % 9) + 1}-0${((i + 2) % 9) + 1}-${d.getFullYear()}`,
      nominal: spp,
      potongan: pot,
      dibayar: pay,
      status: "Lunas",
    });
  }
  return rows.reverse();
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

  const [cabang, setCabang] = useState<string>("Semua"); // "Semua" atau cabangId
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  // ===================== LOAD CABANG (branches) =====================
  useEffect(() => {
    setLoadingCabang(true);
    const qRef = query(collection(db, "branches"), orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Cabang[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, nama: String(data.name || "").trim() };
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

  // cabangList utk pills (Semua + hasil branches)
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

  const history = useMemo(
    () => (selected ? genHistoryDummy(selected.spp) : []),
    [selected]
  );

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
            <View style={styles.pillsRow}>
              {cabangList.map((c) => {
                const active = c.id === cabang;
                return (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.9}
                    onPress={() => {
                      setCabang(c.id);
                      setSelected(null);
                    }}
                    style={[
                      styles.pill,
                      active ? styles.pillActive : styles.pillNormal,
                    ]}
                  >
                    <Text
                      style={[styles.pillText, active && { color: "#0F172A" }]}
                    >
                      {c.nama}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
              Klik siswa untuk lihat mutasi pembayaran (dummy).
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

            <View style={{ gap: 10 }}>
              {history.map((m, idx) => (
                <View key={idx} style={styles.mutasiItem}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.mutasiBulan}>{m.bulan}</Text>
                    <Text style={styles.mutasiTanggal}>{m.tanggal}</Text>
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
                </View>
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.backBtn}
              onPress={() => setSelected(null)}
            >
              <Ionicons name="arrow-back" size={18} color="#0F172A" />
              <Text style={styles.backText}>Kembali</Text>
            </TouchableOpacity>

            <Text style={styles.note}>* Data mutasi masih dummy.</Text>
          </View>
        )}

        <View style={{ height: Platform.OS === "ios" ? 8 : 16 }} />
      </ScrollView>
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

// ✅ styles kamu biarkan sama persis
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

  title: { fontSize: 26, fontWeight: "900", color: "#0F172A", marginTop: 10 },
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

  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillActive: { backgroundColor: "#DBEAFE", borderColor: "#BFDBFE" },
  pillNormal: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" },
  pillText: { fontWeight: "900", color: "#64748B" },

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
  itemTitle: { fontWeight: "900", color: "#0F172A", fontSize: 15 },
  itemSub: { marginTop: 4, color: "#64748B", fontWeight: "700" },

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
  badgeText: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

  bigName: {
    marginTop: 10,
    fontWeight: "900",
    color: "#0F172A",
    fontSize: 18,
  },
  meta: { marginTop: 6, color: "#64748B", fontWeight: "800" },

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
  mutasiTanggal: { fontWeight: "800", color: "#94A3B8" },
  mutasiRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  k: { color: "#64748B", fontWeight: "800" },
  v: { color: "#0F172A", fontWeight: "900" },
  vStrong: { color: "#0F172A", fontWeight: "900" },

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
  backText: { color: "#0F172A", fontWeight: "900" },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
  },
});
