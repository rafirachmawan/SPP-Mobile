import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Cabang = {
  id: string;
  nama: string;
  alamat?: string;
  aktif: boolean;
};

export default function CabangPage() {
  const initial = useMemo<Cabang[]>(
    () => [
      {
        id: "C1",
        nama: "Shining Sun - Cabang A",
        alamat: "Jl. Mawar 1",
        aktif: true,
      },
      {
        id: "C2",
        nama: "Shining Sun - Cabang B",
        alamat: "Jl. Melati 2",
        aktif: true,
      },
      {
        id: "C3",
        nama: "Shining Sun - Cabang C",
        alamat: "Jl. Kenanga 3",
        aktif: true,
      },
    ],
    []
  );

  const [items, setItems] = useState<Cabang[]>(initial);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((x) => x.nama.toLowerCase().includes(qq));
  }, [q, items]);

  function resetForm() {
    setNama("");
    setAlamat("");
  }

  function onAdd() {
    const n = nama.trim();
    if (!n) return Alert.alert("Gagal", "Nama cabang wajib diisi.");

    const newItem: Cabang = {
      id: `C${Date.now()}`,
      nama: n,
      alamat: alamat.trim() || "-",
      aktif: true,
    };

    setItems((prev) => [newItem, ...prev]);
    setShowForm(false);
    resetForm();
    Alert.alert("Berhasil", "Cabang ditambahkan (dummy).");
  }

  function onToggleAktif(id: string) {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, aktif: !x.aktif } : x))
    );
  }

  function onEdit(item: Cabang) {
    Alert.alert(
      "Edit Cabang (dummy)",
      `Nanti bisa edit nama/alamat.\n\nCabang: ${item.nama}`
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
        <Header title="Cabang" subtitle="Tambah & kelola cabang." />

        {/* Search + Add */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cari Cabang</Text>

          <View style={styles.inputWrap}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Ketik nama cabang..."
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
            <View style={styles.rightIcon}>
              <Ionicons name="search-outline" size={18} color="#64748B" />
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.primaryBtn}
            onPress={() => setShowForm((v) => !v)}
          >
            <Ionicons
              name={showForm ? "close-outline" : "add-outline"}
              size={20}
              color="#fff"
            />
            <Text style={styles.primaryText}>
              {showForm ? "Tutup Form" : "Tambah Cabang"}
            </Text>
          </TouchableOpacity>

          {showForm && (
            <View style={styles.formBox}>
              <Text style={styles.label}>Nama Cabang</Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={nama}
                  onChangeText={setNama}
                  placeholder="Contoh: Shining Sun - Cabang D"
                  placeholderTextColor="#94A3B8"
                  style={styles.input2}
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>
                Alamat (opsional)
              </Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={alamat}
                  onChangeText={setAlamat}
                  placeholder="Contoh: Jl. Anggrek 4"
                  placeholderTextColor="#94A3B8"
                  style={styles.input2}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.saveBtn}
                onPress={onAdd}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.saveText}>Simpan Cabang</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* List */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Daftar Cabang</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filtered.length} Cabang</Text>
            </View>
          </View>

          <View style={{ marginTop: 12, gap: 10 }}>
            {filtered.length === 0 ? (
              <Text style={styles.empty}>Belum ada cabang.</Text>
            ) : (
              filtered.map((c) => (
                <View key={c.id} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{c.nama}</Text>
                    <Text style={styles.itemSub}>{c.alamat || "-"}</Text>

                    <View
                      style={{ flexDirection: "row", gap: 8, marginTop: 10 }}
                    >
                      <View
                        style={[
                          styles.pill,
                          c.aktif ? styles.pillOk : styles.pillOff,
                        ]}
                      >
                        <Text style={styles.pillText}>
                          {c.aktif ? "Aktif" : "Nonaktif"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.smallBtn}
                      onPress={() => onEdit(c)}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={18}
                        color="#0F172A"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[
                        styles.smallBtn,
                        c.aktif ? styles.smallWarn : styles.smallOk,
                      ]}
                      onPress={() => onToggleAktif(c.id)}
                    >
                      <Ionicons
                        name={c.aktif ? "pause-outline" : "play-outline"}
                        size={18}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.note}>
            * Ini masih dummy. Nanti disimpan ke Firebase.
          </Text>
        </View>

        <View style={{ height: Platform.OS === "ios" ? 8 : 16 }} />
      </ScrollView>
    </View>
  );
}

/* ===================== Shared UI ===================== */
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

  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#0EA5E9",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "white", fontWeight: "900", fontSize: 15 },

  formBox: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  label: { fontWeight: "900", color: "#0F172A" },
  inputWrap2: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: "center",
  },
  input2: { fontSize: 14, color: "#0F172A", fontWeight: "700" },

  saveBtn: {
    marginTop: 14,
    backgroundColor: "#16A34A",
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: "white", fontWeight: "900" },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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

  item: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 10,
  },
  itemTitle: { fontWeight: "900", color: "#0F172A", fontSize: 15 },
  itemSub: { marginTop: 4, color: "#64748B", fontWeight: "700" },

  pill: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillOk: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  pillOff: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  pillText: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

  smallBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallOk: { backgroundColor: "#16A34A" },
  smallWarn: { backgroundColor: "#F97316" },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
  },
  empty: { color: "#64748B", fontWeight: "700" },
});
