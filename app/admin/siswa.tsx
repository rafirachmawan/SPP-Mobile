import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Student = {
  id: string;
  name: string;
  tipe: "Normal" | "Beasiswa 0" | "Beasiswa 100" | "Pertemuan (8x)";
  sppDefault: number;
};

type PaidRow = {
  bulan: string; // contoh: "Desember 2025"
  tanggalBayar: string; // contoh: "05-12-2025"
  nominal: number; // nominal asli
  potonganSpin: number; // potongan yg dipakai bulan itu
  dibayar: number; // nominal - potongan
  metode: "Cash" | "Transfer";
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

// ✅ dummy riwayat TERBAYAR untuk beberapa bulan ke belakang
function genPaidHistoryDummy(s: Student): PaidRow[] {
  const now = new Date();
  const paidMonths = 8; // jumlah bulan terbayar yang ditampilkan (ubah sesuai kebutuhan)
  const rows: PaidRow[] = [];

  for (let i = paidMonths; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);

    const nominal = s.tipe === "Beasiswa 0" ? 0 : s.sppDefault;

    // dummy potongan spin kadang ada
    const potonganSpin =
      s.tipe.includes("Beasiswa") || nominal === 0
        ? 0
        : i % 3 === 0
        ? 10000
        : 0;

    const dibayar = Math.max(nominal - potonganSpin, 0);

    const tanggalBayar = `0${(i % 9) + 1}-0${
      ((i + 2) % 9) + 1
    }-${d.getFullYear()}`;

    rows.push({
      bulan: bulanIndo(d),
      tanggalBayar,
      nominal,
      potonganSpin,
      dibayar,
      metode: i % 2 === 0 ? "Transfer" : "Cash",
    });
  }

  return rows.reverse(); // terbaru di atas
}

export default function TabSiswa() {
  // ✅ nanti ini dari Firebase sesuai cabang admin
  const siswa = useMemo<Student[]>(
    () => [
      { id: "S1", name: "ANAK A", tipe: "Normal", sppDefault: 200000 },
      { id: "S2", name: "ANAK B", tipe: "Beasiswa 0", sppDefault: 0 },
      { id: "S3", name: "ANAK C", tipe: "Pertemuan (8x)", sppDefault: 150000 },
      { id: "S4", name: "ANAK D", tipe: "Beasiswa 100", sppDefault: 100000 },
      { id: "S5", name: "ANAK E", tipe: "Normal", sppDefault: 200000 },
    ],
    []
  );

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return siswa;
    return siswa.filter((x) => x.name.toLowerCase().includes(qq));
  }, [q, siswa]);

  const history = useMemo(() => {
    if (!selected) return [];
    return genPaidHistoryDummy(selected);
  }, [selected]);

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Shining Sun 🎈</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Cabang</Text>
          </View>
        </View>

        <Text style={styles.title}>Siswa</Text>
        <Text style={styles.subtitle}>
          Klik nama siswa untuk melihat{" "}
          <Text style={styles.bold}>mutasi pembayaran yang sudah terbayar</Text>
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

            <View style={{ marginTop: 12, gap: 10 }}>
              {filtered.length === 0 ? (
                <Text style={styles.empty}>Tidak ada siswa.</Text>
              ) : (
                filtered.slice(0, 12).map((s) => (
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
                ))
              )}
            </View>
          </View>
        ) : (
          /* === DETAIL MUTASI TERBAYAR === */
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

            <View style={{ gap: 10 }}>
              {history.map((m, idx) => (
                <View key={idx} style={styles.mutasiItem}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.mutasiBulan}>{m.bulan}</Text>
                    <View style={[styles.badge, styles.badgeOk]}>
                      <Text style={styles.badgeText2}>Lunas</Text>
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
                    <Text style={styles.meta2}>{m.tanggalBayar}</Text>
                  </View>

                  <View style={styles.mutasiRow}>
                    <Text style={styles.meta}>Metode</Text>
                    <Text style={styles.meta2}>{m.metode}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.secondaryBtn}
              onPress={() => setSelected(null)}
            >
              <Ionicons name="arrow-back" size={18} color="#0F172A" />
              <Text style={styles.secondaryText}>Kembali ke daftar siswa</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              * Data di atas masih dummy. Nanti diisi dari Firebase /
              Spreadsheet realtime.
            </Text>
          </View>
        )}

        <View style={{ height: Platform.OS === "ios" ? 8 : 16 }} />
      </ScrollView>
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
  bigName: { marginTop: 10, fontWeight: "900", color: "#0F172A", fontSize: 18 },
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

  meta: { color: "#64748B", fontWeight: "800" },
  meta2: { color: "#0F172A", fontWeight: "900" },
  money: { color: "#0F172A", fontWeight: "900" },

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

  empty: { color: "#64748B", fontWeight: "700" },
});
