// FILE: app/superadmin/admin-cabang.tsx
// ✅ FULL — UI & LOGIKA ASLI
// ✅ TAMBAHAN SAJA: HAPUS ADMIN CABANG (HARD DELETE)

import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
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

// ✅ Firebase
import {
  createUserWithEmailAndPassword,
  signOut as signOutAuth,
} from "firebase/auth";
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
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db, getSecondaryAuth } from "../../firebase";

type Cabang = { id: string; nama: string };
type AdminCabang = {
  id: string;
  nama: string;
  username: string;
  cabangId: string;
  aktif: boolean;
  uid?: string;
};

function normalizeUsername(u: string) {
  return u.trim().toLowerCase().replace(/\s+/g, "");
}

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
  blue50: "#DBEAFE",
  blue200: "#BFDBFE",
};

const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

export default function AdminCabangPage() {
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  const [cabang, setCabang] = useState<Cabang[]>([]);
  const [items, setItems] = useState<AdminCabang[]>([]);
  const [loadingCabang, setLoadingCabang] = useState(true);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [nama, setNama] = useState("");
  const [username, setUsername] = useState("");
  const [cabangId, setCabangId] = useState<string>("");
  const [password, setPassword] = useState("");

  const [showCabangPicker, setShowCabangPicker] = useState(false);
  const [cabangSearch, setCabangSearch] = useState("");

  // ===================== LOAD CABANG =====================
  useEffect(() => {
    const qRef = query(collection(db, "branches"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Cabang[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, nama: String(data.name || "") };
        });
        setCabang(rows);
        setLoadingCabang(false);
        if (!cabangId && rows.length > 0) setCabangId(rows[0].id);
      },
      () => {
        setLoadingCabang(false);
        Alert.alert("Gagal", "Tidak bisa mengambil data unit.");
      },
    );
    return () => unsub();
  }, []);

  // ===================== LOAD ADMIN CABANG =====================
  useEffect(() => {
    const qRef = query(
      collection(db, "branch_admins"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: AdminCabang[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            uid: String(data.uid || ""),
            nama: String(data.nama || ""),
            username: String(data.username || ""),
            cabangId: String(data.cabangId || ""),
            aktif: data.aktif !== false,
          };
        });
        setItems(rows);
        setLoadingAdmin(false);
      },
      () => {
        setLoadingAdmin(false);
        Alert.alert("Gagal", "Tidak bisa mengambil data admin unit.");
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter(
      (x) =>
        x.nama.toLowerCase().includes(qq) ||
        x.username.toLowerCase().includes(qq),
    );
  }, [q, items]);

  function cabangName(id: string) {
    return cabang.find((c) => c.id === id)?.nama || "-";
  }

  function resetForm() {
    setNama("");
    setUsername("");
    setPassword("");
    setCabangSearch("");
    if (cabang.length > 0) setCabangId(cabang[0].id);
  }

  async function ensureSuperadmin() {
    const u = auth.currentUser;
    if (!u) throw new Error("Belum login.");

    const snap = await getDoc(doc(db, "users", u.uid));
    if (!snap.exists()) throw new Error("Data user tidak ada di users.");

    const data = snap.data() as any;
    if (data.active === false) throw new Error("Akun nonaktif.");
    if (data.role !== "SUPERADMIN")
      throw new Error("Ditolak: hanya SUPERADMIN.");
  }

  // ===================== CREATE ADMIN =====================
  async function onAdd() {
    const n = nama.trim();
    const u = normalizeUsername(username);
    const p = password;

    if (!n || !u || !p || !cabangId)
      return Alert.alert("Gagal", "Lengkapi form admin.");

    if (p.length < 6)
      return Alert.alert("Gagal", "Password minimal 6 karakter.");

    try {
      await ensureSuperadmin();

      const emailInternal = `${u}@cabang.spp`;
      const secondary = getSecondaryAuth();
      const cred = await createUserWithEmailAndPassword(
        secondary,
        emailInternal,
        p,
      );
      const newUid = cred.user.uid;
      await signOutAuth(secondary);

      await setDoc(
        doc(db, "users", newUid),
        {
          role: "ADMIN_CABANG",
          active: true,
          nama: n,
          username: u,
          cabangId,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.uid || null,
        },
        { merge: true },
      );

      await addDoc(collection(db, "branch_admins"), {
        uid: newUid,
        nama: n,
        username: u,
        cabangId,
        aktif: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || null,
      });

      setShowForm(false);
      resetForm();
      Alert.alert("Berhasil", "Admin unit berhasil dibuat.");
    } catch (e: any) {
      Alert.alert("Gagal", e?.message || "Gagal membuat admin.");
    }
  }

  // ===================== TOGGLE AKTIF =====================
  async function onToggleAktif(item: AdminCabang) {
    try {
      await ensureSuperadmin();
      const next = !item.aktif;

      await updateDoc(doc(db, "branch_admins", item.id), {
        aktif: next,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || null,
      });

      if (item.uid) {
        await updateDoc(doc(db, "users", item.uid), {
          active: next,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || null,
        });
      }
    } catch (e: any) {
      Alert.alert("Gagal", e?.message || "Tidak bisa mengubah status.");
    }
  }

  // ===================== HAPUS ADMIN CABANG =====================
  async function onDeleteAdmin(item: AdminCabang) {
    Alert.alert(
      "Hapus Admin Unit",
      `Admin "${item.nama}" akan DIHAPUS PERMANEN.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await ensureSuperadmin();
              await deleteDoc(doc(db, "branch_admins", item.id));
              if (item.uid) {
                await deleteDoc(doc(db, "users", item.uid));
              }
              Alert.alert("Berhasil", "Admin unit dihapus.");
            } catch (e: any) {
              Alert.alert("Gagal", e?.message || "Gagal menghapus admin.");
            }
          },
        },
      ],
    );
  }

  function onResetPass(_: AdminCabang) {
    Alert.alert(
      "Reset Password",
      "Reset password dilakukan via Firebase Console.",
    );
  }

  const cabangFiltered = useMemo(() => {
    const qq = cabangSearch.trim().toLowerCase();
    if (!qq) return cabang;
    return cabang.filter((c) => c.nama.toLowerCase().includes(qq));
  }, [cabangSearch, cabang]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ✅ Modal Dropdown Cabang */}
      <Modal
        visible={showCabangPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCabangPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCabangPicker(false)}
        />
        <View
          style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pilih Cabang</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowCabangPicker(false)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={18} color={THEME.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchWrap}>
            <Ionicons name="search-outline" size={18} color={THEME.sub} />
            <TextInput
              value={cabangSearch}
              onChangeText={setCabangSearch}
              placeholder="Cari unit..."
              placeholderTextColor="#94A3B8"
              style={styles.modalSearchInput}
              autoCorrect={false}
            />
          </View>

          <ScrollView
            style={{ marginTop: 10, maxHeight: 380 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loadingCabang ? (
              <Text style={styles.loadingText}>Memuat unit...</Text>
            ) : cabang.length === 0 ? (
              <Text style={styles.warnText}>
                Belum ada unit. Tambah unit dulu.
              </Text>
            ) : cabangFiltered.length === 0 ? (
              <Text style={styles.note}>Unit tidak ditemukan.</Text>
            ) : (
              cabangFiltered.map((c) => {
                const active = cabangId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.9}
                    style={[styles.cabangRow, active && styles.cabangRowActive]}
                    onPress={() => {
                      setCabangId(c.id);
                      setShowCabangPicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.cabangRowTitle,
                          active && { color: THEME.text },
                        ]}
                      >
                        {c.nama}
                      </Text>
                    </View>

                    {active ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={THEME.green}
                      />
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#94A3B8"
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <Text style={[styles.note, { marginTop: 10 }]}>
            Tip: cari nama unit biar cepat.
          </Text>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            // ✅ atas aman notch/status bar
            paddingTop: Math.max(insets.top, 14),
            // ✅ bawah aman dari tabbar + gesture bar
            paddingBottom: tabH + insets.bottom + 18,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Admin Unit"
          subtitle="Tambah user admin untuk tiap unit."
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
              <Ionicons name="search-outline" size={18} color={THEME.sub} />
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
              {showForm ? "Tutup Form" : "Tambah Admin unit"}
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
                  placeholder="contoh: adminA"
                  placeholderTextColor="#94A3B8"
                  style={styles.input2}
                  autoCapitalize="none"
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Pilih unit</Text>

              {loadingCabang ? (
                <Text style={styles.loadingText}>Memuat unit...</Text>
              ) : cabang.length === 0 ? (
                <Text style={styles.warnText}>
                  Belum ada unit. Tambah unit dulu.
                </Text>
              ) : (
                <>
                  {/* ✅ Dropdown bersih (modal) */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.selectBox}
                    onPress={() => setShowCabangPicker(true)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectLabel}>Unit Terpilih</Text>
                      <Text style={styles.selectValue}>
                        {cabangName(cabangId)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color={THEME.sub} />
                  </TouchableOpacity>

                  <Text style={styles.helper}>
                    Klik untuk memilih unit lain.
                  </Text>
                </>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="password minimal 6"
                  placeholderTextColor="#94A3B8"
                  style={styles.input2}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.saveBtn}
                onPress={onAdd}
                disabled={cabang.length === 0}
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
            {loadingAdmin ? (
              <Text style={styles.note}>Memuat data...</Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.note}>Belum ada admin unit.</Text>
            ) : (
              filtered.map((a) => (
                <View key={a.id} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{a.nama}</Text>
                    <Text style={styles.itemSub}>
                      @{a.username} • {cabangName(a.cabangId)}
                    </Text>

                    <View
                      style={{ flexDirection: "row", gap: 8, marginTop: 10 }}
                    >
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
                      <Ionicons
                        name="key-outline"
                        size={18}
                        color={THEME.text}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[
                        styles.smallBtn,
                        a.aktif ? styles.smallWarn : styles.smallOk,
                      ]}
                      onPress={() => onToggleAktif(a)}
                    >
                      <Ionicons
                        name={a.aktif ? "pause-outline" : "play-outline"}
                        size={18}
                        color="#fff"
                      />
                    </TouchableOpacity>
                    {/* 🔴 DELETE ADMIN */}
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[styles.smallBtn, { backgroundColor: "#EF4444" }]}
                      onPress={() => onDeleteAdmin(a)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.note}>
            * Admin dibuat oleh SUPERADMIN langsung dari app
          </Text>
        </View>

        <View style={{ height: Platform.OS === "ios" ? 8 : 16 }} />
      </ScrollView>
    </SafeAreaView>
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

  // ✅ Dropdown Box (bersih)
  selectBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectLabel: {
    fontFamily: F.semibold,
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 2,
  },
  selectValue: {
    fontFamily: F.extrabold,
    color: THEME.text,
    fontSize: 14,
  },
  helper: {
    marginTop: 6,
    color: THEME.sub,
    fontFamily: F.semibold,
    fontSize: 12,
  },

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

  pillSmall: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  ok: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  off: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  pillSmallText: { fontFamily: F.extrabold, fontSize: 12, color: THEME.text },

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
    lineHeight: 16,
  },

  loadingText: {
    marginTop: 8,
    color: THEME.sub,
    fontFamily: F.semibold,
  },
  warnText: {
    marginTop: 8,
    color: "#ef4444",
    fontFamily: F.extrabold,
  },

  // ✅ Modal styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.35)",
  },
  modalSheet: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 120,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 14,
    shadowColor: THEME.text,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  modalTitle: {
    fontFamily: F.extrabold,
    color: THEME.text,
    fontSize: 16,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(226,232,240,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 46,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.text,
    fontFamily: F.semibold,
  },
  cabangRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  cabangRowActive: {
    backgroundColor: THEME.blue50,
    borderColor: THEME.blue200,
  },
  cabangRowTitle: {
    fontFamily: F.extrabold,
    color: THEME.text,
    fontSize: 14,
  },
  cabangRowSub: {
    marginTop: 2,
    fontFamily: F.semibold,
    color: "#94A3B8",
    fontSize: 12,
  },
});
