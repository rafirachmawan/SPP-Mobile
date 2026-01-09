import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

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

type Student = {
  id: string;
  name: string;
  type: "Normal" | "Beasiswa 0" | "Beasiswa 100" | "Pertemuan";
  spp: number;
  pertemuan?: number;
};

function rupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default function BayarSPP() {
  const today = new Date();
  const day = today.getDate();
  const canSpin = day < 11;

  // ===== dummy siswa (nanti dari Firebase) =====
  const [students] = useState<Student[]>([
    { id: "1", name: "ANAK A", type: "Normal", spp: 200000 },
    { id: "2", name: "ANAK B", type: "Beasiswa 0", spp: 0 },
    { id: "3", name: "ANAK C", type: "Pertemuan", spp: 150000, pertemuan: 8 },
    { id: "4", name: "ANAK D", type: "Beasiswa 100", spp: 100000 },
    { id: "5", name: "ANAK E", type: "Normal", spp: 200000 },
  ]);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, students]);

  function openAction(s: Student) {
    setSelected(s);
    setModalOpen(true);
  }

  function bayarSekarang() {
    if (!selected) return;
    Alert.alert(
      "Pembayaran Berhasil",
      `${selected.name}\nSPP bulan ini: ${rupiah(selected.spp)}`
    );
    setModalOpen(false);
  }

  function spinHadiah() {
    if (!canSpin) {
      Alert.alert(
        "Spin Ditutup",
        "Spin hanya bisa dilakukan sebelum tanggal 11."
      );
      return;
    }

    const hadiah = [0, 10000, 20000, 50000, 100000];
    const hasil = hadiah[Math.floor(Math.random() * hadiah.length)];

    Alert.alert(
      "🎁 Hasil Spin",
      `${selected?.name}\nPotongan bulan depan: ${rupiah(hasil)}`
    );
    setModalOpen(false);
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <Text style={styles.brand}>Shining Sun 🎈</Text>
        <Text style={styles.title}>Bayar SPP</Text>
        <Text style={styles.subtitle}>
          Cari nama siswa → klik siswa → Bayar atau Spin.
        </Text>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            placeholder="Ketik nama siswa..."
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* List siswa */}
        <View style={styles.card}>
          {filtered.map((s) => (
            <TouchableOpacity
              key={s.id}
              activeOpacity={0.9}
              onPress={() => openAction(s)}
              style={styles.row}
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={16} color="#1E40AF" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.meta}>
                  {s.type === "Pertemuan"
                    ? `Pertemuan (${s.pertemuan}x)`
                    : s.type}{" "}
                  • {rupiah(s.spp)}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.note}>ℹ️ Spin hanya aktif sebelum tanggal 11.</Text>
      </ScrollView>

      {/* MODAL AKSI */}
      <Modal visible={modalOpen} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            {selected && (
              <>
                <Text style={styles.modalTitle}>{selected.name}</Text>
                <Text style={styles.modalSub}>
                  {selected.type} • {rupiah(selected.spp)}
                </Text>

                <TouchableOpacity style={styles.payBtn} onPress={bayarSekarang}>
                  <Ionicons name="cash-outline" size={18} color="#fff" />
                  <Text style={styles.payText}>Bayar Sekarang</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.spinBtn, !canSpin && { opacity: 0.4 }]}
                  onPress={spinHadiah}
                  disabled={!canSpin}
                >
                  <Ionicons name="gift-outline" size={18} color="#0F172A" />
                  <Text style={styles.spinText}>
                    Spin (Potongan Bulan Depan)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setModalOpen(false)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeText}>Tutup</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 28 },
  brand: { color: "#2563EB", fontWeight: "900" },
  title: { fontSize: 26, fontWeight: "900", marginTop: 6 },
  subtitle: {
    color: THEME.sub,
    marginTop: 6,
    marginBottom: 12,
    fontWeight: "700",
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontWeight: "800" },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontWeight: "900" },
  meta: { color: THEME.sub, fontWeight: "700", fontSize: 12 },

  note: {
    marginTop: 10,
    textAlign: "center",
    color: "#64748B",
    fontWeight: "800",
    fontSize: 12,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  modalSub: { marginTop: 4, color: THEME.sub, fontWeight: "700" },

  payBtn: {
    marginTop: 14,
    backgroundColor: THEME.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  payText: { color: "#fff", fontWeight: "900" },

  spinBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  spinText: { fontWeight: "900" },

  closeBtn: { marginTop: 10, alignItems: "center" },
  closeText: { fontWeight: "900", color: "#EF4444" },
});
