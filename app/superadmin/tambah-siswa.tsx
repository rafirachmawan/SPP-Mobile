// FILE: app/superadmin/tambah-siswa.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// ✅ Firebase (samakan dengan file superadmin lain kamu)
import { auth, db } from "../../firebase";
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
  where,
} from "firebase/firestore";

type Branch = { id: string; name: string };

type StudentType = "Normal" | "Beasiswa 0" | "Beasiswa 100" | "Pertemuan";

type Student = {
  id: string;
  name: string;
  branchId: string;
  type: StudentType;
  sppDefault: number; // default SPP
  pertemuan?: number; // kalau type=Pertemuan (misal 8)
  active: boolean;
};

const TYPES: StudentType[] = [
  "Normal",
  "Beasiswa 0",
  "Beasiswa 100",
  "Pertemuan",
];

function toInt(v: string, fallback = 0) {
  const n = Number(String(v || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function rupiah(n: number) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

export default function TambahSiswaPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  const [branchId, setBranchId] = useState<string>(""); // filter & default form cabang
  const [q, setQ] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // === form tambah ===
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<StudentType>("Normal");
  const [sppDefault, setSppDefault] = useState("");
  const [pertemuan, setPertemuan] = useState("8"); // default 8x
  const [saving, setSaving] = useState(false);

  // === edit modal ===
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Student | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<StudentType>("Normal");
  const [editSpp, setEditSpp] = useState("");
  const [editPertemuan, setEditPertemuan] = useState("8");
  const [editBranchId, setEditBranchId] = useState<string>("");

  // ===================== LOAD BRANCHES =====================
  useEffect(() => {
    const qRef = query(collection(db, "branches"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Branch[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, name: String(data.name || "") };
        });
        setBranches(rows);
        setLoadingBranches(false);

        // default pilih cabang pertama
        setBranchId((prev) => prev || (rows[0]?.id ?? ""));
      },
      (err) => {
        console.log(err);
        setLoadingBranches(false);
        Alert.alert("Gagal", "Tidak bisa mengambil data cabang.");
      }
    );

    return () => unsub();
  }, []);

  // ===================== LOAD STUDENTS (by branch filter) =====================
  useEffect(() => {
    if (!branchId) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    setLoadingStudents(true);

    // tampilkan siswa sesuai cabang terpilih
    const qRef = query(
      collection(db, "students"),
      where("branchId", "==", branchId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Student[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: String(data.name || ""),
            branchId: String(data.branchId || ""),
            type: (String(data.type || "Normal") as StudentType) || "Normal",
            sppDefault: Number(data.sppDefault || 0),
            pertemuan:
              data.pertemuan != null ? Number(data.pertemuan || 0) : undefined,
            active: data.active !== false,
          };
        });
        setStudents(rows);
        setLoadingStudents(false);
      },
      (err) => {
        console.log(err);
        setLoadingStudents(false);
        Alert.alert("Gagal", "Tidak bisa mengambil data siswa.");
      }
    );

    return () => unsub();
  }, [branchId]);

  const branchName = useMemo(() => {
    return branches.find((b) => b.id === branchId)?.name || "-";
  }, [branches, branchId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return students;
    return students.filter((s) => s.name.toLowerCase().includes(qq));
  }, [q, students]);

  function resetForm() {
    setName("");
    setType("Normal");
    setSppDefault("");
    setPertemuan("8");
  }

  // ===================== ADD STUDENT =====================
  async function onAdd() {
    const n = name.trim();
    const spp = toInt(sppDefault, 0);
    const prt = toInt(pertemuan, 8);

    if (!auth.currentUser) return Alert.alert("Gagal", "Belum login.");
    if (!branchId) return Alert.alert("Gagal", "Pilih cabang dulu.");
    if (!n) return Alert.alert("Gagal", "Nama siswa wajib diisi.");

    if (type === "Pertemuan") {
      if (prt <= 0) return Alert.alert("Gagal", "Pertemuan harus > 0.");
    }

    // aturan nominal default:
    // - Beasiswa 0 => sppDefault otomatis 0
    // - lainnya => boleh isi, kalau kosong dianggap 0
    const finalSpp = type === "Beasiswa 0" ? 0 : Number.isFinite(spp) ? spp : 0;

    try {
      setSaving(true);

      await addDoc(collection(db, "students"), {
        name: n,
        branchId,
        // optional: simpan juga branchName biar cepat tampil di tempat lain
        branchName,
        type,
        sppDefault: finalSpp,
        pertemuan: type === "Pertemuan" ? prt : null,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid,
      });

      setShowForm(false);
      resetForm();
      Alert.alert("Berhasil", "Siswa berhasil ditambahkan.");
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Tidak bisa menambah siswa.");
    } finally {
      setSaving(false);
    }
  }

  // ===================== DELETE STUDENT =====================
  function onDelete(s: Student) {
    Alert.alert("Hapus Siswa", `Yakin mau hapus "${s.name}"?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "students", s.id));
          } catch (e: any) {
            console.log(e);
            Alert.alert("Gagal", e?.message || "Tidak bisa menghapus.");
          }
        },
      },
    ]);
  }

  // ===================== TOGGLE ACTIVE =====================
  async function onToggleActive(s: Student) {
    try {
      await updateDoc(doc(db, "students", s.id), {
        active: !s.active,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || null,
      });
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Tidak bisa mengubah status.");
    }
  }

  // ===================== OPEN EDIT =====================
  function openEdit(s: Student) {
    setEditItem(s);
    setEditName(s.name);
    setEditType(s.type);
    setEditSpp(String(s.sppDefault || ""));
    setEditPertemuan(String(s.pertemuan ?? 8));
    setEditBranchId(s.branchId);
    setEditOpen(true);
  }

  // ===================== SAVE EDIT =====================
  async function saveEdit() {
    if (!editItem) return;
    const n = editName.trim();
    const spp = toInt(editSpp, 0);
    const prt = toInt(editPertemuan, 8);

    if (!n) return Alert.alert("Gagal", "Nama siswa wajib diisi.");
    if (!editBranchId) return Alert.alert("Gagal", "Cabang wajib dipilih.");

    const finalSpp =
      editType === "Beasiswa 0" ? 0 : Number.isFinite(spp) ? spp : 0;

    try {
      await updateDoc(doc(db, "students", editItem.id), {
        name: n,
        branchId: editBranchId,
        branchName: branches.find((b) => b.id === editBranchId)?.name || "",
        type: editType,
        sppDefault: finalSpp,
        pertemuan: editType === "Pertemuan" ? prt : null,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || null,
      });

      setEditOpen(false);
      setEditItem(null);
      Alert.alert("Berhasil", "Data siswa diperbarui.");
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Tidak bisa menyimpan perubahan.");
    }
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
          title="Tambah / Kelola Siswa"
          subtitle="Pilih cabang, lalu tambah & kelola siswa pada cabang tersebut."
        />

        {/* Filter Cabang */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pilih Cabang</Text>

          {loadingBranches ? (
            <Text style={styles.note}>Memuat cabang...</Text>
          ) : branches.length === 0 ? (
            <Text style={[styles.note, { color: "#ef4444" }]}>
              Belum ada cabang. Tambah cabang dulu.
            </Text>
          ) : (
            <>
              <View style={styles.pillsRow}>
                {branches.map((b) => {
                  const active = b.id === branchId;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      activeOpacity={0.9}
                      onPress={() => {
                        setBranchId(b.id);
                        setShowForm(false);
                      }}
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
                        {b.name}
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
            </>
          )}
        </View>

        {/* Add Form */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Input Siswa</Text>
            <View style={styles.badgeInfo}>
              <Text style={styles.badgeText}>
                {branchId ? branchName : "-"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.primaryBtn}
            onPress={() => setShowForm((v) => !v)}
            disabled={!branchId || branches.length === 0}
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
            <View style={styles.formBox}>
              <Text style={styles.label}>Nama Siswa</Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="contoh: Ahmad"
                  placeholderTextColor="#94A3B8"
                  style={styles.input2}
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Tipe</Text>
              <View style={styles.pillsRow}>
                {TYPES.map((t) => {
                  const active = t === type;
                  return (
                    <TouchableOpacity
                      key={t}
                      activeOpacity={0.9}
                      onPress={() => setType(t)}
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
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>SPP Default</Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={type === "Beasiswa 0" ? "0" : sppDefault}
                  onChangeText={setSppDefault}
                  placeholder="contoh: 200000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  editable={type !== "Beasiswa 0"}
                  style={styles.input2}
                />
              </View>

              {type === "Pertemuan" && (
                <>
                  <Text style={[styles.label, { marginTop: 12 }]}>
                    Jumlah Pertemuan
                  </Text>
                  <View style={styles.inputWrap2}>
                    <TextInput
                      value={pertemuan}
                      onChangeText={setPertemuan}
                      placeholder="contoh: 8"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      style={styles.input2}
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={onAdd}
                disabled={saving}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.saveText}>
                  {saving ? "Menyimpan..." : "Simpan Siswa"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.note}>
                * Data akan masuk ke Firestore: students (branchId = cabang
                terpilih)
              </Text>
            </View>
          )}
        </View>

        {/* List Students */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daftar Siswa</Text>

          <View style={{ marginTop: 12, gap: 10 }}>
            {loadingStudents ? (
              <Text style={styles.note}>Memuat siswa...</Text>
            ) : !branchId ? (
              <Text style={styles.note}>Pilih cabang dulu.</Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.note}>Belum ada siswa di cabang ini.</Text>
            ) : (
              filtered.map((s) => (
                <View key={s.id} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{s.name}</Text>
                    <Text style={styles.itemSub}>
                      {s.type}
                      {s.type === "Pertemuan" && s.pertemuan
                        ? ` (${s.pertemuan}x)`
                        : ""}
                      {" • "}
                      {rupiah(s.sppDefault)}
                    </Text>

                    <View
                      style={{ flexDirection: "row", gap: 8, marginTop: 10 }}
                    >
                      <View
                        style={[
                          styles.pillSmall,
                          s.active ? styles.ok : styles.off,
                        ]}
                      >
                        <Text style={styles.pillSmallText}>
                          {s.active ? "Aktif" : "Nonaktif"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.smallBtn}
                      onPress={() => openEdit(s)}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color="#0F172A"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.9}
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

                    <TouchableOpacity
                      activeOpacity={0.9}
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

          <Text style={styles.note}>
            * List mengikuti cabang yang kamu pilih di atas.
          </Text>
        </View>

        <View style={{ height: Platform.OS === "ios" ? 8 : 16 }} />
      </ScrollView>

      {/* ========= EDIT MODAL ========= */}
      <Modal visible={editOpen} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Edit Siswa</Text>
              <TouchableOpacity
                onPress={() => setEditOpen(false)}
                style={styles.xBtn}
              >
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 10 }]}>Nama</Text>
            <View style={styles.inputWrap2}>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Nama siswa"
                placeholderTextColor="#94A3B8"
                style={styles.input2}
              />
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Cabang</Text>
            <View style={styles.pillsRow}>
              {branches.map((b) => {
                const active = b.id === editBranchId;
                return (
                  <TouchableOpacity
                    key={b.id}
                    activeOpacity={0.9}
                    onPress={() => setEditBranchId(b.id)}
                    style={[
                      styles.pill,
                      active ? styles.pillActive : styles.pillNormal,
                    ]}
                  >
                    <Text
                      style={[styles.pillText, active && { color: "#0F172A" }]}
                    >
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Tipe</Text>
            <View style={styles.pillsRow}>
              {TYPES.map((t) => {
                const active = t === editType;
                return (
                  <TouchableOpacity
                    key={t}
                    activeOpacity={0.9}
                    onPress={() => setEditType(t)}
                    style={[
                      styles.pill,
                      active ? styles.pillActive : styles.pillNormal,
                    ]}
                  >
                    <Text
                      style={[styles.pillText, active && { color: "#0F172A" }]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>SPP Default</Text>
            <View style={styles.inputWrap2}>
              <TextInput
                value={editType === "Beasiswa 0" ? "0" : editSpp}
                onChangeText={setEditSpp}
                placeholder="contoh: 200000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                editable={editType !== "Beasiswa 0"}
                style={styles.input2}
              />
            </View>

            {editType === "Pertemuan" && (
              <>
                <Text style={[styles.label, { marginTop: 12 }]}>
                  Jumlah Pertemuan
                </Text>
                <View style={styles.inputWrap2}>
                  <TextInput
                    value={editPertemuan}
                    onChangeText={setEditPertemuan}
                    placeholder="contoh: 8"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    style={styles.input2}
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.saveAllBtn, { marginTop: 14 }]}
              onPress={saveEdit}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveAllText}>Simpan Perubahan</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              * Edit hanya bisa oleh SUPERADMIN sesuai rules kamu.
            </Text>
          </View>
        </View>
      </Modal>
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

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

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
  smallDanger: { backgroundColor: "#EF4444" },

  badgeInfo: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "white",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  xBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },

  saveAllBtn: {
    backgroundColor: "#1D4ED8",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveAllText: { color: "white", fontWeight: "900", fontSize: 15 },
});
