import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Student = {
  id: string;
  name: string;
  cabang: string;
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
  const cabangList = useMemo(
    () => ["Semua", "Cabang A", "Cabang B", "Cabang C"],
    []
  );

  const siswaAll = useMemo<Student[]>(
    () => [
      {
        id: "S1",
        name: "ANAK A",
        cabang: "Cabang A",
        tipe: "Normal",
        spp: 200000,
      },
      {
        id: "S2",
        name: "ANAK B",
        cabang: "Cabang A",
        tipe: "Beasiswa 0",
        spp: 0,
      },
      {
        id: "S3",
        name: "ANAK C",
        cabang: "Cabang B",
        tipe: "Pertemuan (8x)",
        spp: 150000,
      },
      {
        id: "S4",
        name: "ANAK D",
        cabang: "Cabang C",
        tipe: "Beasiswa 100",
        spp: 100000,
      },
      {
        id: "S5",
        name: "ANAK E",
        cabang: "Cabang C",
        tipe: "Normal",
        spp: 200000,
      },
    ],
    []
  );

  const [cabang, setCabang] = useState("Semua");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  const list = useMemo(() => {
    let base = siswaAll;
    if (cabang !== "Semua") base = base.filter((x) => x.cabang === cabang);

    const qq = q.trim().toLowerCase();
    if (!qq) return base;
    return base.filter((x) => x.name.toLowerCase().includes(qq));
  }, [siswaAll, cabang, q]);

  const history = useMemo(
    () => (selected ? genHistoryDummy(selected.spp) : []),
    [selected]
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Header
          title="Siswa per Cabang"
          subtitle="Pilih cabang, lalu klik siswa untuk lihat mutasi."
        />

        {/* Filter cabang */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filter Cabang</Text>

          <View style={styles.pillsRow}>
            {cabangList.map((c) => {
              const active = c === cabang;
              return (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.9}
                  onPress={() => {
                    setCabang(c);
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
                    {c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
              {list.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  activeOpacity={0.9}
                  style={styles.item}
                  onPress={() => setSelected(s)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{s.name}</Text>
                    <Text style={styles.itemSub}>
                      {s.cabang} • {s.tipe} • Rp {s.spp.toLocaleString("id-ID")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
                </TouchableOpacity>
              ))}
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
              {selected.cabang} • {selected.tipe} • SPP Rp{" "}
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
    </View>
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

  bigName: { marginTop: 10, fontWeight: "900", color: "#0F172A", fontSize: 18 },
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
