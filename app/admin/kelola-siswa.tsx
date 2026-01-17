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
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase";

/* ===================== TYPES (IDENTIK) ===================== */
type StudentType = "Reguler" | "Beasiswa 0" | "Beasiswa 100" | "Pertemuan";

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
  const [type, setType] = useState<StudentType>("Reguler");
  const [sppDefault, setSppDefault] = useState("");
  const [pertemuan, setPertemuan] = useState("8");
  const [saving, setSaving] = useState(false);

  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [typePickerSearch, setTypePickerSearch] = useState("");

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

  /* ===================== DEFAULT SPP ===================== */
  useEffect(() => {
    if (type === "Reguler") setSppDefault((v) => v || rupiah(200000));
    else if (type === "Beasiswa 0") setSppDefault(rupiah(0));
    else if (type === "Beasiswa 100") setSppDefault(rupiah(100000));
  }, [type]);

  /* ===================== ADD ===================== */
  async function onAdd() {
    if (!name.trim()) return Alert.alert("Nama wajib diisi");

    try {
      setSaving(true);
      await addDoc(collection(db, "students"), {
        name: name.trim(),
        branchId,
        branchName,
        type,
        sppDefault: toInt(sppDefault, 0),
        pertemuan: type === "Pertemuan" ? toInt(pertemuan, 8) : null,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid,
      });

      setShowForm(false);
      setName("");
      setType("Reguler");
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
          paddingBottom: tabH + 24,
        }}
      >
        <Text style={styles.title}>Kelola Siswa</Text>
        <Text style={styles.subtitle}>Cabang: {branchName}</Text>

        {/* FORM */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setShowForm(!showForm)}
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

          {showForm && (
            <>
              <TextInput
                placeholder="Nama siswa"
                value={name}
                onChangeText={setName}
                style={styles.input}
              />

              <TouchableOpacity
                style={styles.select}
                onPress={() => setTypePickerOpen(true)}
              >
                <Text>{type}</Text>
              </TouchableOpacity>

              <TextInput
                value={sppDefault}
                onChangeText={(t) => setSppDefault(formatRupiahInput(t))}
                keyboardType="number-pad"
                style={styles.input}
              />

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
                <Text style={styles.saveText}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* LIST */}
        <View style={styles.card}>
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
                    {s.type} • {rupiah(s.sppDefault)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.trash}
                  onPress={() => onDelete(s)}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </TouchableOpacity>
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
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={styles.pickRow}
              onPress={() => {
                setType(t);
                setTypePickerOpen(false);
              }}
            >
              <Text>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  title: { fontSize: 26, fontFamily: F.extrabold },
  subtitle: { color: "#64748B", marginBottom: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
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
    marginTop: 10,
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
    marginTop: 14,
    padding: 14,
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
});
