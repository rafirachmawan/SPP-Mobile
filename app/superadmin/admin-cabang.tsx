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

type Cabang = { id: string; nama: string };
type AdminCabang = {
  id: string;
  nama: string;
  username: string;
  cabangId: string;
  aktif: boolean;
};

export default function AdminCabangPage() {
  const cabang = useMemo<Cabang[]>(
    () => [
      { id: "C1", nama: "Cabang A" },
      { id: "C2", nama: "Cabang B" },
      { id: "C3", nama: "Cabang C" },
    ],
    []
  );

  const initial = useMemo<AdminCabang[]>(
    () => [
      {
        id: "A1",
        nama: "Admin A",
        username: "adminA",
        cabangId: "C1",
        aktif: true,
      },
      {
        id: "A2",
        nama: "Admin B",
        username: "adminB",
        cabangId: "C2",
        aktif: true,
      },
      {
        id: "A3",
        nama: "Admin C",
        username: "adminC",
        cabangId: "C3",
        aktif: false,
      },
    ],
    []
  );

  const [items, setItems] = useState<AdminCabang[]>(initial);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [nama, setNama] = useState("");
  const [username, setUsername] = useState("");
  const [cabangId, setCabangId] = useState("C1");
  const [password, setPassword] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter(
      (x) =>
        x.nama.toLowerCase().includes(qq) ||
        x.username.toLowerCase().includes(qq)
    );
  }, [q, items]);

  function cabangName(id: string) {
    return cabang.find((c) => c.id === id)?.nama || "-";
  }

  function resetForm() {
    setNama("");
    setUsername("");
    setPassword("");
    setCabangId("C1");
  }

  function onAdd() {
    const n = nama.trim();
    const u = username.trim();
    if (!n || !u || !password)
      return Alert.alert("Gagal", "Lengkapi form admin.");

    const newItem: AdminCabang = {
      id: `A${Date.now()}`,
      nama: n,
      username: u,
      cabangId,
      aktif: true,
    };

    setItems((prev) => [newItem, ...prev]);
    setShowForm(false);
    resetForm();
    Alert.alert("Berhasil", "Admin cabang ditambahkan (dummy).");
  }

  function onToggleAktif(id: string) {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, aktif: !x.aktif } : x))
    );
  }

  function onResetPass(item: AdminCabang) {
    Alert.alert(
      "Reset Password (dummy)",
      `Nanti pakai Firebase.\n\nAdmin: ${item.username}`
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
        <Header
          title="Admin Cabang"
          subtitle="Tambah user admin untuk tiap cabang."
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cari Admin</Text>

          <View style={styles.inputWrap}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Cari nama / username..."
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
              {showForm ? "Tutup Form" : "Tambah Admin Cabang"}
            </Text>
          </TouchableOpacity>

          {showForm && (
            <View style={styles.formBox}>
              <Text style={styles.label}>Nama Admin</Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={nama}
                  onChangeText={setNama}
                  placeholder="Nama admin"
                  placeholderTextColor="#94A3B8"
                  style={styles.input2}
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Username</Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="username"
                  placeholderTextColor="#94A3B8"
                  style={styles.input2}
                  autoCapitalize="none"
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>
                Pilih Cabang
              </Text>
              <View style={styles.pillsRow}>
                {cabang.map((c) => {
                  const active = cabangId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.9}
                      onPress={() => setCabangId(c.id)}
                      style={[
                        styles.pill,
                        active ? styles.pillActive : styles.pillNormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          active && { color: "#0F172A" },
                        ]}
                      >
                        {c.nama}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>
                Password (sementara)
              </Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="password"
                  placeholderTextColor="#94A3B8"
                  style={styles.input2}
                  secureTextEntry
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
                <Text style={styles.saveText}>Simpan Admin</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daftar Admin</Text>

          <View style={{ marginTop: 12, gap: 10 }}>
            {filtered.map((a) => (
              <View key={a.id} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{a.nama}</Text>
                  <Text style={styles.itemSub}>
                    @{a.username} • {cabangName(a.cabangId)}
                  </Text>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <View
                      style={[
                        styles.pillSmall,
                        a.aktif ? styles.ok : styles.off,
                      ]}
                    >
                      <Text style={styles.pillSmallText}>
                        {a.aktif ? "Aktif" : "Nonaktif"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.smallBtn}
                    onPress={() => onResetPass(a)}
                  >
                    <Ionicons name="key-outline" size={18} color="#0F172A" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={[
                      styles.smallBtn,
                      a.aktif ? styles.smallWarn : styles.smallOk,
                    ]}
                    onPress={() => onToggleAktif(a.id)}
                  >
                    <Ionicons
                      name={a.aktif ? "pause-outline" : "play-outline"}
                      size={18}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.note}>
            * Dummy UI. Nanti akun dibuat di Firebase Auth.
          </Text>
        </View>

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

  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillActive: { backgroundColor: "#DBEAFE", borderColor: "#BFDBFE" },
  pillNormal: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" },
  pillText: { fontWeight: "900", color: "#64748B" },

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

  pillSmall: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  ok: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  off: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  pillSmallText: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

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
});
