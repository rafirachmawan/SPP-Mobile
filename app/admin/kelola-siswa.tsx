// FILE: app/admin/kelola-siswa.tsx
// ✅ FINAL FIXED VERSION
// - SINKRON 100% DENGAN SUPERADMIN
// - cabangId = SINGLE SOURCE OF TRUTH
// - DATA SHARED REALTIME

import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
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

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../../firebase";

/* ===================== TYPES (IDENTIK) ===================== */
type StudentType =
  | "NONE"
  | "Reguler"
  | "Beasiswa 0"
  | "Beasiswa 100"
  | "Pertemuan";

type Student = {
  id: string;
  name: string;
  branchId: string;
  type: StudentType;
  sppDefault: number;
  pertemuan?: number;
  active: boolean;
};

const TYPES: StudentType[] = [
  "Reguler",
  "Beasiswa 0",
  "Beasiswa 100",
  "Pertemuan",
];

const DEFAULT_SPP: Record<StudentType, number> = {
  NONE: 0,
  Reguler: 200000,
  "Beasiswa 0": 0,
  "Beasiswa 100": 100000,
  Pertemuan: 0,
};

/* ===================== UTIL ===================== */
const F = {
  semibold: "Inter_600SemiBold",
  extrabold: "Inter_800ExtraBold",
};

const rupiah = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

const toInt = (v: string, f = 0) =>
  Number(String(v || "").replace(/[^\d]/g, "")) || f;

const formatRupiahInput = (v: string) => (v ? rupiah(toInt(v)) : "");

/* ===================== COMPONENT ===================== */
export default function KelolaSiswaAdmin() {
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  const [branchId, setBranchId] = useState("");
  const [branchName, setBranchName] = useState("-");

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<StudentType>("NONE");

  const [sppDefault, setSppDefault] = useState("");
  const [pertemuan, setPertemuan] = useState("8");
  const [saving, setSaving] = useState(false);

  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [typePickerSearch, setTypePickerSearch] = useState("");

  // ===================== EDIT STATE (ADMIN) =====================
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Student | null>(null);

  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<StudentType>("NONE");
  const [editSpp, setEditSpp] = useState("");
  const [editPertemuan, setEditPertemuan] = useState("8");

  /* ===================== LOAD CABANG (FINAL) ===================== */
  useEffect(() => {
    (async () => {
      const u = auth.currentUser;
      if (!u) return;

      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data() as any;

      const bid = String(data?.cabangId || "").trim();
      if (!bid) {
        Alert.alert("Error", "Akun admin belum terikat cabang");
        return;
      }

      setBranchId(bid);

      const bSnap = await getDoc(doc(db, "branches", bid));
      if (bSnap.exists()) setBranchName(bSnap.data().name || "-");
    })();
  }, []);

  /* ===================== LOAD STUDENTS (IDENTIK) ===================== */
  useEffect(() => {
    if (!branchId) return;

    const qRef = query(
      collection(db, "students"),
      where("branchId", "==", branchId),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(qRef, (snap) => {
      setStudents(
        snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            id: d.id,
            name: x.name,
            branchId: x.branchId,
            type: x.type,
            sppDefault: Number(x.sppDefault || 0),
            pertemuan: x.pertemuan ?? undefined,
            active: x.active !== false,
          };
        }),
      );
      setLoading(false);
    });

    return () => unsub();
  }, [branchId]);

  function onChangeType(t: StudentType) {
    setType(t);

    // 🔒 set nominal otomatis & aman
    setSppDefault(rupiah(DEFAULT_SPP[t]));

    // default pertemuan
    if (t === "Pertemuan") {
      setPertemuan("8");
    }
  }

  function onChangeEditType(t: StudentType) {
    setEditType(t);

    // set nominal otomatis
    setEditSpp(rupiah(DEFAULT_SPP[t]));

    if (t === "Pertemuan") {
      setEditPertemuan("8");
    }
  }

  /* ===================== ADD ===================== */
  async function onAdd() {
    if (!name.trim()) return Alert.alert("Nama wajib diisi");
    if (type === "NONE") {
      return Alert.alert("Tipe siswa wajib dipilih");
    }

    try {
      setSaving(true);
      await addDoc(collection(db, "students"), {
        name: name.trim(),
        branchId,
        branchName,
        type,
        sppDefault:
          type === "Reguler"
            ? DEFAULT_SPP.Reguler
            : toInt(sppDefault, DEFAULT_SPP[type]),

        pertemuan: type === "Pertemuan" ? toInt(pertemuan, 8) : null,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid,
      });

      setShowForm(false);
      setName("");
      setType("NONE");
      setSppDefault("");

      setPertemuan("8");
    } catch (e: any) {
      Alert.alert("Gagal", e.message);
    } finally {
      setSaving(false);
    }
  }

  /* ===================== DELETE ===================== */
  function onDelete(s: Student) {
    Alert.alert("Hapus Siswa", `Hapus "${s.name}"?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => deleteDoc(doc(db, "students", s.id)),
      },
    ]);
  }
  /* ===================== EDIT ===================== */
  function openEdit(s: Student) {
    setEditItem(s);
    setEditName(s.name);
    setEditType(s.type);
    setEditSpp(rupiah(s.sppDefault));
    setEditPertemuan(String(s.pertemuan ?? 8));
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editItem) return;
    if (!editName.trim()) return Alert.alert("Nama wajib diisi");
    if (editType === "NONE") return Alert.alert("Tipe wajib dipilih");

    try {
      await updateDoc(doc(db, "students", editItem.id), {
        name: editName.trim(),
        type: editType,
        sppDefault:
          editType === "Reguler"
            ? DEFAULT_SPP.Reguler
            : toInt(editSpp, DEFAULT_SPP[editType]),
        pertemuan: editType === "Pertemuan" ? toInt(editPertemuan, 8) : null,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid,
      });

      setEditOpen(false);
      setEditItem(null);
    } catch (e: any) {
      Alert.alert("Gagal", e.message);
    }
  }

  /* ===================== TOGGLE ACTIVE ===================== */
  async function onToggleActive(s: Student) {
    try {
      await updateDoc(doc(db, "students", s.id), {
        active: !s.active,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid,
      });
    } catch (e: any) {
      Alert.alert("Gagal", e.message);
    }
  }

  const filtered = useMemo(
    () =>
      students.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())),
    [q, students],
  );

  /* ===================== UI ===================== */
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 18,
          paddingTop: insets.top + 18,
          paddingBottom: tabH + 60,
        }}
      >
        <Text style={styles.title}>Kelola Siswa</Text>
        <Text style={styles.subtitle}>Cabang: {branchName}</Text>

        {/* FORM */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              if (!showForm) {
                setName("");
                setType("NONE");
                setSppDefault("");
                setPertemuan("8");
              }
              setShowForm(!showForm);
            }}
          >
            <Ionicons
              name={showForm ? "close-outline" : "add-outline"}
              size={20}
              color="#fff"
            />
            <Text style={styles.primaryText}>
              {showForm ? "Tutup Form" : "Tambah Siswa"}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 14 }} />

          {showForm && (
            <>
              <Text style={styles.formHeader}>Data Siswa Baru</Text>

              <Text style={styles.formLabel}>Nama Siswa</Text>
              <TextInput
                placeholder="Contoh: Ahmad Fauzi"
                value={name}
                onChangeText={setName}
                style={styles.input}
              />

              <Text style={styles.formLabel}>Tipe Siswa</Text>
              <TouchableOpacity
                style={styles.select}
                onPress={() => setTypePickerOpen(true)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontFamily: F.semibold,
                    color: type === "NONE" ? "#94A3B8" : "#0F172A",
                  }}
                >
                  {type === "NONE" ? "Pilih Tipe Siswa" : type}
                </Text>

                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>

              <Text style={styles.formLabel}>Nominal SPP</Text>

              <TextInput
                value={sppDefault}
                editable={type === "Pertemuan"}
                selectTextOnFocus={type === "Pertemuan"}
                onChangeText={(t) => setSppDefault(formatRupiahInput(t))}
                keyboardType="number-pad"
                placeholder={
                  type === "NONE"
                    ? "Pilih tipe siswa terlebih dahulu"
                    : undefined
                }
                style={[
                  styles.input,
                  type !== "Pertemuan" && styles.inputLocked,
                ]}
              />

              {type !== "Pertemuan" && (
                <Text style={styles.helperText}>
                  Nominal otomatis sesuai tipe siswa
                </Text>
              )}

              {type === "Pertemuan" && (
                <TextInput
                  value={pertemuan}
                  onChangeText={setPertemuan}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              )}

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={onAdd}
                disabled={saving}
              >
                <View style={{ height: 10 }} />

                <Text style={styles.saveText}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {showForm && <View style={{ height: 12 }} />}
        </View>

        {/* LIST */}
        <View style={styles.card}>
          <Text style={styles.listHeader}>Daftar Siswa</Text>

          <View
            style={{
              height: 1,
              backgroundColor: "#E2E8F0",
              marginBottom: 12,
            }}
          />

          <TextInput
            placeholder="Cari siswa..."
            value={q}
            onChangeText={setQ}
            style={styles.input}
          />

          {loading ? (
            <Text>Memuat...</Text>
          ) : (
            filtered.map((s) => (
              <View key={s.id} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{s.name}</Text>
                  <Text style={styles.itemSub}>
                    {s.type}
                    {s.type === "Pertemuan" && s.pertemuan
                      ? ` (${s.pertemuan}x)`
                      : ""}{" "}
                    • {rupiah(s.sppDefault)}
                  </Text>

                  <Text style={{ fontSize: 11, marginTop: 4 }}>
                    Status: {s.active ? "Aktif" : "Nonaktif"}
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  {/* EDIT */}
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => openEdit(s)}
                  >
                    <Ionicons name="create-outline" size={18} color="#0F172A" />
                  </TouchableOpacity>

                  {/* AKTIF / NONAKTIF */}
                  <TouchableOpacity
                    style={[
                      styles.smallBtn,
                      s.active ? styles.smallWarn : styles.smallOk,
                    ]}
                    onPress={() => onToggleActive(s)}
                  >
                    <Ionicons
                      name={s.active ? "pause-outline" : "play-outline"}
                      size={18}
                      color="#fff"
                    />
                  </TouchableOpacity>

                  {/* DELETE */}
                  <TouchableOpacity
                    style={[styles.smallBtn, styles.smallDanger]}
                    onPress={() => onDelete(s)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* TYPE PICKER */}
      <Modal visible={typePickerOpen} transparent animationType="fade">
        <Pressable
          style={styles.overlay}
          onPress={() => setTypePickerOpen(false)}
        />
        <View style={styles.modal}>
          {TYPES.map((t) => {
            const current = editOpen ? editType : type;
            const active = t === current;

            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.pickRow,
                  active && { backgroundColor: "#E0F2FE" },
                ]}
                onPress={() => {
                  if (editOpen) {
                    onChangeEditType(t); // 🟧 EDIT
                  } else {
                    onChangeType(t); // 🟦 ADD
                  }
                  setTypePickerOpen(false);
                }}
              >
                <Text style={{ fontFamily: F.semibold }}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
      {/* ===================== EDIT MODAL ===================== */}
      <Modal visible={editOpen} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.formHeader}>Edit Siswa</Text>

            <Text style={styles.formLabel}>Nama</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={styles.input}
            />

            <Text style={styles.formLabel}>Tipe</Text>
            <TouchableOpacity
              style={styles.select}
              onPress={() => setTypePickerOpen(true)}
            >
              <Text>{editType === "NONE" ? "Pilih Tipe" : editType}</Text>
              <Ionicons name="chevron-down" size={18} />
            </TouchableOpacity>

            <Text style={styles.formLabel}>Nominal SPP</Text>
            <TextInput
              value={editSpp}
              editable={editType === "Pertemuan"}
              onChangeText={(t) => setEditSpp(formatRupiahInput(t))}
              keyboardType="number-pad"
              style={[
                styles.input,
                editType !== "Pertemuan" && styles.inputLocked,
              ]}
            />

            {editType === "Pertemuan" && (
              <TextInput
                value={editPertemuan}
                onChangeText={setEditPertemuan}
                keyboardType="number-pad"
                style={styles.input}
              />
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
              <Text style={styles.saveText}>Simpan Perubahan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  smallBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  smallOk: { backgroundColor: "#16A34A" },
  smallWarn: { backgroundColor: "#F97316" },
  smallDanger: { backgroundColor: "#EF4444" },

  listHeader: {
    fontSize: 14,
    fontFamily: F.extrabold,
    marginBottom: 10,
  },

  formHeader: {
    fontSize: 14,
    fontFamily: F.extrabold,
    marginTop: 2, // ⬅️ TAMBAHAN
    marginBottom: 10,
  },

  inputLocked: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
  },

  helperText: {
    marginTop: 6,
    fontSize: 11,
    color: "#64748B",
  },

  title: { fontSize: 26, fontFamily: F.extrabold },
  subtitle: { color: "#64748B", marginBottom: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    paddingBottom: 22, // ⬅️ TAMBAHAN PENTING
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 22,
  },

  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },

  select: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  primaryBtn: {
    backgroundColor: "#0EA5E9",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },

  primaryText: { color: "#fff", fontFamily: F.extrabold },

  saveBtn: {
    backgroundColor: "#16A34A",
    marginTop: 18, // ⬅️ tambah jarak
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },

  saveText: { color: "#fff", fontFamily: F.extrabold },

  item: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
  },
  itemTitle: { fontFamily: F.extrabold },
  itemSub: { color: "#64748B" },

  trash: {
    backgroundColor: "#EF4444",
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modal: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 160,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
  },
  pickRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  formLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 12,
    color: "#475569",
    fontFamily: F.semibold,
  },
});
