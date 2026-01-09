import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Student = {
  id: string;
  name: string;
  tipe: "Normal" | "Beasiswa 0" | "Beasiswa 100" | "Pertemuan (8x)";
  nominal: number;
};

export default function TabBayarSPP() {
  const today = new Date();
  const canSpin = today.getDate() < 11;

  // ✅ nanti ini dari Firebase sesuai cabang admin
  const students = useMemo<Student[]>(
    () => [
      { id: "S1", name: "ANAK A", tipe: "Normal", nominal: 200000 },
      { id: "S2", name: "ANAK B", tipe: "Beasiswa 0", nominal: 0 },
      { id: "S3", name: "ANAK C", tipe: "Pertemuan (8x)", nominal: 150000 },
      { id: "S4", name: "ANAK D", tipe: "Beasiswa 100", nominal: 100000 },
      { id: "S5", name: "ANAK E", tipe: "Normal", nominal: 200000 },
    ],
    []
  );

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return students;
    return students.filter((x) => x.name.toLowerCase().includes(qq));
  }, [q, students]);

  function onPay() {
    if (!selected) return;
    Alert.alert(
      "Berhasil (dummy)",
      `Pembayaran SPP untuk ${selected.name} tersimpan.`
    );
  }

  function onSpin() {
    if (!selected) return;
    if (!canSpin)
      return Alert.alert("Tidak bisa spin", "Spin hanya sebelum tanggal 11.");
    Alert.alert(
      "Hasil Spin (dummy)",
      `🎉 ${selected.name} dapat potongan Rp 10.000 untuk bulan depan.`
    );
  }

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
            <Text style={styles.chipText}>
              {canSpin ? "Spin ON" : "Spin OFF"}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>Bayar SPP</Text>
        <Text style={styles.subtitle}>
          Cari nama siswa → klik siswa → muncul tombol{" "}
          <Text style={styles.bold}>Bayar</Text> &{" "}
          <Text style={styles.bold}>Spin</Text>.
        </Text>

        {/* Card: Cari + List */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cari Siswa 🧸</Text>

          <View style={styles.inputWrap}>
            <TextInput
              value={q}
              onChangeText={(t) => {
                setQ(t);
                if (!t.trim()) setSelected(null);
              }}
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
              filtered.slice(0, 10).map((s) => {
                const active = selected?.id === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    activeOpacity={0.9}
                    onPress={() => setSelected(s)}
                    style={[
                      styles.studentItem,
                      active && styles.studentItemActive,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{s.name}</Text>
                      <Text style={styles.studentSub}>
                        {s.tipe} • Rp {s.nominal.toLocaleString("id-ID")}
                      </Text>
                    </View>

                    <Ionicons
                      name={active ? "checkmark-circle" : "chevron-forward"}
                      size={22}
                      color={active ? "#16A34A" : "#94A3B8"}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* Card: Aksi Bayar + Spin */}
        {selected ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Aksi Pembayaran</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{selected.tipe}</Text>
              </View>
            </View>

            <Text style={styles.bigName}>{selected.name}</Text>
            <Text style={styles.meta}>
              Nominal:{" "}
              <Text style={styles.meta2}>
                Rp {selected.nominal.toLocaleString("id-ID")}
              </Text>
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.primaryBtn}
                onPress={onPay}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.primaryText}>Bayar SPP</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.spinBtn, !canSpin && { opacity: 0.55 }]}
                onPress={onSpin}
                disabled={!canSpin}
              >
                <Ionicons name="gift-outline" size={18} color="#fff" />
                <Text style={styles.spinText}>Spin</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.secondaryBtn}
              onPress={() => setSelected(null)}
            >
              <Ionicons name="close-circle-outline" size={18} color="#0F172A" />
              <Text style={styles.secondaryText}>Batal pilih siswa</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              * Spin hanya sebelum tanggal 11. Hasil spin dipakai untuk potongan
              bulan depan.
            </Text>
          </View>
        ) : (
          <View style={styles.helperCard}>
            <Text style={styles.helperText}>
              Pilih siswa dulu agar tombol Bayar & Spin muncul 😊
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
  studentItemActive: { borderColor: "#86EFAC", backgroundColor: "#F0FDF4" },
  studentName: { fontWeight: "900", color: "#0F172A", fontSize: 15 },
  studentSub: { marginTop: 4, color: "#64748B", fontWeight: "700" },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

  bigName: { marginTop: 10, fontWeight: "900", color: "#0F172A", fontSize: 18 },
  meta: { marginTop: 8, color: "#64748B", fontWeight: "800" },
  meta2: { color: "#0F172A", fontWeight: "900" },

  actions: { marginTop: 14, flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#0EA5E9",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "white", fontWeight: "900", fontSize: 15 },

  spinBtn: {
    width: 110,
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  spinText: { color: "white", fontWeight: "900", fontSize: 14 },

  secondaryBtn: {
    marginTop: 10,
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

  helperCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  helperText: { textAlign: "center", color: "#64748B", fontWeight: "800" },

  empty: { color: "#64748B", fontWeight: "700" },
});
