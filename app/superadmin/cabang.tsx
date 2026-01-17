// FILE: app/superadmin/unit.tsx
// ✅ FULL — UI & LOGIKA ASLI
// ✅ TAMBAHAN: HARD DELETE UNIT (PERMANEN)

import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

type Unit = {
  id: string;
  nama: string;
  alamat?: string;
  aktif: boolean;
};

const THEME = {
  bg1: "#BFE9FF",
  bg2: "#EAF6FF",
  bg3: "#F7FBFF",
  text: "#0F172A",
  sub: "#64748B",
  border: "#E2E8F0",
  card: "rgba(255,255,255,0.92)",
  primary: "#0EA5E9",
  green: "#16A34A",
  orange: "#F97316",
};

const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

export default function UnitPage() {
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  const [items, setItems] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");

  const [editId, setEditId] = useState<string | null>(null);

  // ===================== LOAD REALTIME FROM FIRESTORE =====================
  useEffect(() => {
    const qRef = query(
      collection(db, "branches"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Unit[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            nama: String(data.name || ""),
            alamat: String(data.address || ""),
            aktif: data.active !== false,
          };
        });

        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.log("branches snapshot error:", err);
        setLoading(false);
        Alert.alert("Gagal", "Tidak bisa mengambil data unit (cek rules).");
      }
    );

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter(
      (x) =>
        x.nama.toLowerCase().includes(qq) ||
        (x.alamat || "").toLowerCase().includes(qq)
    );
  }, [q, items]);

  function resetForm() {
    setNama("");
    setAlamat("");
    setEditId(null);
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  async function onSave() {
    const n = nama.trim();
    const a = alamat.trim();

    if (!n) return Alert.alert("Gagal", "Nama unit wajib diisi.");

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return Alert.alert("Gagal", "Belum login.");

      if (editId) {
        await updateDoc(doc(db, "branches", editId), {
          name: n,
          address: a || "-",
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        });

        Alert.alert("Berhasil", "Unit berhasil diupdate.");
      } else {
        await addDoc(collection(db, "branches"), {
          name: n,
          address: a || "-",
          active: true,
          createdAt: serverTimestamp(),
          createdBy: uid,
        });

        Alert.alert("Berhasil", "Unit berhasil ditambahkan.");
      }

      setShowForm(false);
      resetForm();
    } catch (e: any) {
      console.log("save branch error:", e);
      Alert.alert("Gagal", e?.message || "Tidak bisa menyimpan unit.");
    }
  }

  async function onToggleAktif(item: Unit) {
    try {
      const uid = auth.currentUser?.uid || null;
      await updateDoc(doc(db, "branches", item.id), {
        active: !item.aktif,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    } catch (e: any) {
      console.log("toggle error:", e);
      Alert.alert("Gagal", e?.message || "Tidak bisa mengubah status unit.");
    }
  }

  // ===================== HARD DELETE =====================
  function onDelete(item: Unit) {
    Alert.alert(
      "Hapus Unit",
      `Unit "${item.nama}" akan DIHAPUS PERMANEN.\n\nTindakan ini tidak bisa dibatalkan.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Permanen",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "branches", item.id));
              Alert.alert("Berhasil", "Unit berhasil dihapus permanen.");
            } catch (e: any) {
              console.log("delete error:", e);
              Alert.alert(
                "Gagal",
                e?.message || "Tidak bisa menghapus unit."
              );
            }
          },
        },
      ]
    );
  }

  function onEdit(item: Unit) {
    setEditId(item.id);
    setNama(item.nama);
    setAlamat(item.alamat && item.alamat !== "-" ? item.alamat : "");
    setShowForm(true);
  }

  function onCancelEdit() {
    resetForm();
    setShowForm(false);
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
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
        <Header title="Unit" subtitle="Tambah & kelola unit." />

        {/* ===================== SEARCH + ADD ===================== */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cari Unit</Text>

          <View style={styles.inputWrap}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Ketik nama unit..."
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
            onPress={() => {
              if (!showForm) openAddForm();
              else setShowForm((v) => !v);
            }}
          >
            <Ionicons
              name={showForm ? "close-outline" : "add-outline"}
              size={20}
              color="#fff"
            />
            <Text style={styles.primaryText}>
              {showForm ? "Tutup Form" : "Tambah Unit"}
            </Text>
          </TouchableOpacity>

          {showForm && (
            <View style={styles.formBox}>
              <Text style={styles.label}>
                {editId ? "Edit Unit" : "Tambah Unit"}
              </Text>

              <Text style={[styles.label, { marginTop: 12 }]}>Nama Unit</Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={nama}
                  onChangeText={setNama}
                  placeholder="Contoh: Shining Sun - Unit D"
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
                onPress={onSave}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.saveText}>
                  {editId ? "Update Unit" : "Simpan Unit"}
                </Text>
              </TouchableOpacity>

              {editId && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.saveBtn, { backgroundColor: "#64748B" }]}
                  onPress={onCancelEdit}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.saveText}>Batal Edit</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ===================== LIST ===================== */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Daftar Unit</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {loading ? "..." : `${filtered.length} Unit`}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 12, gap: 10 }}>
            {loading ? (
              <Text style={styles.empty}>Memuat data...</Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.empty}>Belum ada unit.</Text>
            ) : (
              filtered.map((c) => (
                <View key={c.id} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{c.nama}</Text>
                    <Text style={styles.itemSub}>{c.alamat || "-"}</Text>

                    <View style={{ flexDirection: "row", marginTop: 10 }}>
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
                        color={THEME.text}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[
                        styles.smallBtn,
                        c.aktif ? styles.smallWarn : styles.smallOk,
                      ]}
                      onPress={() => onToggleAktif(c)}
                    >
                      <Ionicons
                        name={c.aktif ? "pause-outline" : "play-outline"}
                        size={18}
                        color="#fff"
                      />
                    </TouchableOpacity>

                    {/* 🔴 DELETE */}
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[styles.smallBtn, { backgroundColor: "#EF4444" }]}
                      onPress={() => onDelete(c)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.note}>
            * Data unit tersimpan ke Firebase (Firestore) & realtime.
          </Text>
        </View>

        <View style={{ height: Platform.OS === "ios" ? 8 : 16 }} />
      </ScrollView>
    </SafeAreaView>
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
    color: THEME.text,
    marginTop: 10,
  },
  subtitle: {
    color: THEME.sub,
    lineHeight: 20,
    fontFamily: F.semibold,
    marginTop: 2,
  },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    shadowColor: THEME.text,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontFamily: F.extrabold, color: THEME.text },

  inputWrap: {
    marginTop: 12,
    position: "relative",
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 42,
    height: 48,
    justifyContent: "center",
  },
  input: { fontSize: 14, color: THEME.text, fontFamily: F.semibold },
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
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "white", fontFamily: F.extrabold, fontSize: 15 },

  formBox: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  label: { fontFamily: F.extrabold, color: THEME.text },
  inputWrap2: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: "center",
  },
  input2: { fontSize: 14, color: THEME.text, fontFamily: F.semibold },

  saveBtn: {
    marginTop: 14,
    backgroundColor: THEME.green,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: "white", fontFamily: F.extrabold },

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
  badgeText: { fontFamily: F.extrabold, fontSize: 12, color: THEME.text },

  item: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 10,
  },
  itemTitle: { fontFamily: F.extrabold, color: THEME.text, fontSize: 15 },
  itemSub: { marginTop: 4, color: THEME.sub, fontFamily: F.semibold },

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
  pillText: { fontFamily: F.extrabold, fontSize: 12, color: THEME.text },

  smallBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallOk: { backgroundColor: THEME.green },
  smallWarn: { backgroundColor: THEME.orange },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontFamily: F.semibold,
    fontSize: 12,
  },
  empty: { color: THEME.sub, fontFamily: F.semibold },
});
