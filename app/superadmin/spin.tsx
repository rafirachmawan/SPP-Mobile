import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "../../firebase"; // sesuaikan path

// ✅ tambah field kuota
type Hadiah = {
  id: string;
  label: string;
  nominal: number;
  peluang: number;
  kuota?: number | "-"; // ⬅️ PENTING
  _kuotaAwal?: number | "-";
};

// const DOC_PATH = { col: "spin_settings", id: "global" };

const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

function formatRupiahInput(value: string) {
  // ambil angka saja
  const numeric = value.replace(/[^\d]/g, "");
  const numberValue = Number(numeric || 0);

  if (!numberValue) {
    return { raw: 0, formatted: "" };
  }

  return {
    raw: numberValue, // ⬅️ angka murni
    formatted: `Rp ${numberValue.toLocaleString("id-ID")}`, // ⬅️ tampilan
  };
}

function toInt(v: string, fallback = 0) {
  const n = Number(String(v || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SpinSettingPage() {
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();
  const [branchId, setBranchId] = useState<string>("");

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  // ===== default dummy kalau belum ada data di Firestore =====
  const dummyHadiah = useMemo<Hadiah[]>(
    () => [
      {
        id: "H1",
        label: "Potongan 10.000",
        nominal: 10000,
        peluang: 35,
        kuota: 0,
      },
      {
        id: "H2",
        label: "Potongan 20.000",
        nominal: 20000,
        peluang: 25,
        kuota: 0,
      },
      {
        id: "H3",
        label: "Potongan 50.000",
        nominal: 50000,
        peluang: 10,
        kuota: 0,
      },
      { id: "H4", label: "Zonk", nominal: 0, peluang: 30, kuota: 0 },
    ],
    [],
  );

  const [items, setItems] = useState<Hadiah[]>(dummyHadiah);

  const [showForm, setShowForm] = useState(false);

  const [label, setLabel] = useState("");
  const [nominal, setNominal] = useState("");
  const [peluang, setPeluang] = useState("");
  const [kuota, setKuota] = useState(""); // ✅ input kuota di form tambah hadiah

  const [sebelumTanggal, setSebelumTanggal] = useState("11");
  const [dipakaiBulanDepan, setDipakaiBulanDepan] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () => items.reduce((a, b) => a + (b.peluang || 0), 0),
    [items],
  );

  // ===================== AMBIL branchId ADMIN =====================
  useEffect(() => {
    (async () => {
      try {
        const u = auth.currentUser;
        if (!u) return;

        const snap = await getDoc(doc(db, "users", u.uid));
        if (!snap.exists()) return;

        const data = snap.data() as any;
        const bid = String(data.cabangId || data.branchId || "").trim();
        if (!bid) return;

        // setBranchId(bid);
      } catch (e) {
        console.log("load branchId error", e);
      }
    })();
  }, []);

  // 🔥 RESET daftar hadiah kalau unit belum dipilih
  useEffect(() => {
    if (!branchId) {
      setItems([]);
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "branches"));
      setBranches(
        snap.docs.map((d) => ({
          id: d.id,
          name: String((d.data() as any).name || "Unit"),
        })),
      );
    })();
  }, []);

  // ===================== LOAD dari Firestore =====================
  useEffect(() => {
    (async () => {
      try {
        if (!branchId) return;

        setLoading(true);

        // ===================== 🅰️ LOAD HADIAH GLOBAL =====================
        const globalRef = doc(db, "spin_settings", "global");
        const globalSnap = await getDoc(globalRef);

        if (!globalSnap.exists()) {
          setItems([]);
          return;
        }

        const globalData = globalSnap.data() as any;
        const hadiahTemplate = Array.isArray(globalData.hadiahTemplate)
          ? globalData.hadiahTemplate
          : [];

        setSebelumTanggal(String(globalData.sebelumTanggal ?? "11"));
        setDipakaiBulanDepan(globalData.dipakaiBulanDepan !== false);

        // ===================== 🅱️ LOAD KUOTA PER UNIT (STRICT) =====================
        const kuotaRef = doc(db, "spin_kuota", branchId);
        const kuotaSnap = await getDoc(kuotaRef);

        if (!kuotaSnap.exists()) {
          Alert.alert(
            "Kuota belum diset",
            "Silakan set kuota voucher di Superadmin terlebih dahulu.",
          );
          setItems([]);
          return;
        }

        const kd = kuotaSnap.data() as any;

        if (!Array.isArray(kd.kuota) || kd.kuota.length === 0) {
          Alert.alert(
            "Kuota kosong",
            "Kuota voucher untuk unit ini masih kosong. Silakan set ulang di Superadmin.",
          );
          setItems([]);
          return;
        }

        const nowMonth = getMonthKey();
        let kuotaMap: Record<string, { kuota: number; kuotaAwal: number }> = {};

        // 🔁 reset bulanan (jika perlu)
        if (kd.lastResetMonth !== nowMonth) {
          kd.kuota.forEach((k: any) => {
            kuotaMap[k.id] = {
              kuota: k.kuotaAwal,
              kuotaAwal: k.kuotaAwal,
            };
          });

          await setDoc(
            kuotaRef,
            {
              kuota: Object.entries(kuotaMap).map(([id, v]) => ({
                id,
                kuota: v.kuota,
                kuotaAwal: v.kuotaAwal,
              })),
              lastResetMonth: nowMonth,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } else {
          kd.kuota.forEach((k: any) => {
            kuotaMap[k.id] = {
              kuota: k.kuota,
              kuotaAwal: k.kuotaAwal,
            };
          });
        }

        // ===================== 🅲 GABUNG (GLOBAL + UNIT) =====================
        const mergedItems: Hadiah[] = hadiahTemplate.map((h: any) => ({
          id: h.id,
          label: h.label,
          nominal: Number(h.nominal || 0),
          peluang: Number(h.peluang || 0),
          kuota: kuotaMap[h.id]?.kuota ?? 0,
          _kuotaAwal: kuotaMap[h.id]?.kuotaAwal ?? 0,
        }));

        setItems(mergedItems);
      } catch (e) {
        console.log(e);
        Alert.alert("Gagal", "Tidak bisa memuat setting spin.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  function addHadiah() {
    const l = label.trim();
    const n = toInt(nominal, 0);
    const p = toInt(peluang, 0);
    const raw = kuota.trim();
    const q = raw === "-" ? "-" : toInt(raw, 0);

    if (!l) return Alert.alert("Gagal", "Nama hadiah wajib diisi.");
    if (!Number.isFinite(n) || n < 0)
      return Alert.alert("Gagal", "Nominal tidak valid.");
    if (!Number.isFinite(p) || p <= 0)
      return Alert.alert("Gagal", "Peluang harus > 0.");
    if (q !== "-" && (!Number.isFinite(q) || q < 0)) {
      return Alert.alert(
        "Gagal",
        'Kuota tidak valid (gunakan "-" untuk unlimited, 0 untuk habis)',
      );
    }

    const safeId = l
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    setItems((prev) => [
      {
        id: safeId, // 🔥 ID STABIL
        label: l,
        nominal: n,
        peluang: p,
        kuota: q,
        _kuotaAwal: q,
      },
      ...prev,
    ]);

    setLabel("");
    setNominal("");
    setPeluang("");
    setKuota("");
    setShowForm(false);
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  // ✅ edit kuota inline (tanpa ubah logika lain)
  function updateKuota(id: string, v: string) {
    const raw = v.trim();
    const q = raw === "-" ? "-" : toInt(raw, 0);

    if (q !== "-" && q < 0) return;

    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, kuota: q, _kuotaAwal: q } : x)),
    );
  }

  async function saveAll() {
    const tgl = toInt(sebelumTanggal, 11);

    if (tgl < 1 || tgl > 31)
      return Alert.alert("Gagal", "Tanggal harus 1 - 31.");

    if (items.length === 0)
      return Alert.alert("Gagal", "Minimal harus ada 1 hadiah.");

    if (total !== 100) {
      return Alert.alert(
        "Total peluang belum 100%",
        `Sekarang total: ${total}%.\n\nBiar adil, idealnya 100%.`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Tetap Simpan", onPress: () => doSave(tgl) },
        ],
      );
    }

    return doSave(tgl);
  }

  async function doSave(tgl: number) {
    try {
      if (!branchId) {
        Alert.alert("Gagal", "Unit belum terdeteksi.");
        return;
      }

      setSaving(true);

      // ===================== 🅰️ SIMPAN HADIAH GLOBAL =====================
      await setDoc(
        doc(db, "spin_settings", "global"),
        {
          sebelumTanggal: tgl,
          dipakaiBulanDepan,
          hadiahTemplate: items.map(({ kuota, _kuotaAwal, ...h }) => h),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // // ===================== 🅰️ SIMPAN HADIAH GLOBAL =====================
      // await setDoc(
      //   doc(db, "spin_settings", "global"),
      //   {
      //     sebelumTanggal: tgl,
      //     dipakaiBulanDepan,
      //     hadiahTemplate: items.map(({ kuota, _kuotaAwal, ...h }) => h),
      //     updatedAt: serverTimestamp(),
      //   },
      //   { merge: true },
      // );

      // ✅ HANYA SEED KE UNIT YANG BELUM PUNYA DATA
      const branchesSnap = await getDocs(collection(db, "branches"));

      for (const b of branchesSnap.docs) {
        const bid = b.id;
        const kuotaRef = doc(db, "spin_kuota", bid);
        const kuotaSnap = await getDoc(kuotaRef);

        if (!kuotaSnap.exists()) {
          await setDoc(kuotaRef, {
            kuota: items.map((h) => ({
              id: h.id,
              kuota: h._kuotaAwal ?? 0,
              kuotaAwal: h._kuotaAwal ?? 0,
            })),
            lastResetMonth: getMonthKey(),
            createdAt: serverTimestamp(),
          });
        }
      }

      // ===================== 🅱️ SIMPAN KUOTA UNIT AKTIF =====================
      await setDoc(
        doc(db, "spin_kuota", branchId),
        {
          kuota: items.map((h) => ({
            id: h.id,
            kuota: h._kuotaAwal ?? h.kuota ?? 0,
            kuotaAwal: h._kuotaAwal ?? h.kuota ?? 0,
          })),
          lastResetMonth: getMonthKey(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      Alert.alert("Berhasil", "Setting spin tersimpan.");
    } catch (e: any) {
      console.log(e);
      Alert.alert("Gagal", e?.message || "Tidak bisa menyimpan setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            // ✅ aman notch/statusbar
            paddingTop: Math.max(insets.top, 14),
            // ✅ aman dari tabbar + gesture bar
            paddingBottom: tabH + insets.bottom + 18,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Hadiah Spin"
          subtitle="Atur hadiah, peluang, dan aturan spin."
        />
        <View style={styles.unitSelectBox}>
          <Text style={styles.unitSelectLabel}>Pilih Unit</Text>

          {/* Trigger dropdown */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.unitDropdownTrigger}
            onPress={() => setShowUnitDropdown((v) => !v)}
          >
            <Text style={styles.unitDropdownText}>
              {branches.find((b) => b.id === branchId)?.name || "Pilih Unit"}
            </Text>
            <Ionicons
              name={showUnitDropdown ? "chevron-up" : "chevron-down"}
              size={18}
              color="#0F172A"
            />
          </TouchableOpacity>

          {/* Dropdown list */}
          {showUnitDropdown &&
            branches.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.unitDropdownItem,
                  branchId === b.id && styles.unitDropdownItemActive,
                ]}
                onPress={() => {
                  setBranchId(b.id);
                  setShowUnitDropdown(false); // 🔥 auto close
                }}
              >
                <Text style={styles.unitDropdownItemText}>{b.name}</Text>
              </TouchableOpacity>
            ))}
        </View>

        <View style={styles.card}>
          {!branchId ? (
            // ⛔ BELUM PILIH UNIT
            <Text style={styles.note}>
              Silakan pilih unit terlebih dahulu untuk mengatur spin 🎯
            </Text>
          ) : loading ? (
            <Text style={styles.note}>Memuat setting...</Text>
          ) : (
            <>
              <Text style={styles.cardTitle}>Aturan Spin</Text>

              <Text style={styles.label}>Spin hanya sebelum tanggal</Text>
              <View style={styles.inputWrap2}>
                <TextInput
                  value={sebelumTanggal}
                  onChangeText={setSebelumTanggal}
                  placeholder="11"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  style={styles.input2}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.toggleBtn,
                  dipakaiBulanDepan && {
                    backgroundColor: "#DCFCE7",
                    borderColor: "#BBF7D0",
                  },
                ]}
                onPress={() => setDipakaiBulanDepan((v) => !v)}
              >
                <Ionicons
                  name={
                    dipakaiBulanDepan
                      ? "checkmark-circle-outline"
                      : "ellipse-outline"
                  }
                  size={18}
                  color="#0F172A"
                />
                <Text style={styles.toggleText}>
                  Hasil spin dipakai bulan depan
                </Text>
              </TouchableOpacity>

              <View style={styles.hr} />

              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Daftar Hadiah</Text>
                <View
                  style={[
                    styles.badge,
                    total === 100
                      ? { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" }
                      : { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
                  ]}
                >
                  <Text style={styles.badgeText}>Total: {total}%</Text>
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
                  {showForm ? "Tutup Form" : "Tambah Hadiah"}
                </Text>
              </TouchableOpacity>

              {showForm && (
                <View style={styles.formBox}>
                  <Text style={styles.label}>Nama Hadiah</Text>
                  <View style={styles.inputWrap2}>
                    <TextInput
                      value={label}
                      onChangeText={setLabel}
                      placeholder="Potongan 10.000"
                      placeholderTextColor="#94A3B8"
                      style={styles.input2}
                    />
                  </View>

                  <Text style={[styles.label, { marginTop: 12 }]}>Nominal</Text>
                  <View style={styles.inputWrap2}>
                    <TextInput
                      value={nominal}
                      onChangeText={(v) => {
                        const { formatted } = formatRupiahInput(v);
                        setNominal(formatted);
                      }}
                      placeholder="Rp 10.000"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      style={styles.input2}
                    />
                  </View>

                  <Text style={[styles.label, { marginTop: 12 }]}>
                    Peluang (%)
                  </Text>
                  <View style={styles.inputWrap2}>
                    <TextInput
                      value={peluang}
                      onChangeText={setPeluang}
                      placeholder="35"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      style={styles.input2}
                    />
                  </View>

                  {/* <Text style={[styles.label, { marginTop: 12 }]}>
                    Kuota (- = unlimited, 0 = habis)
                  </Text> */}
                  <View style={styles.inputWrap2}>
                    <TextInput
                      value={kuota}
                      onChangeText={setKuota}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      keyboardType="default"
                      style={styles.input2}
                    />
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.saveBtn}
                    onPress={addHadiah}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.saveText}>Simpan Hadiah</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ marginTop: 12, gap: 10 }}>
                {items.map((h) => (
                  <View key={h.id} style={styles.item}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{h.label}</Text>
                      <Text style={styles.itemSub}>
                        Nominal: Rp {h.nominal.toLocaleString("id-ID")} •
                        Peluang: {h.peluang}% • Kuota:{" "}
                        {h.kuota === "-" ? "∞" : h.kuota}
                        {/* <Text style={styles.inlineHint}>
                          (- = ∞, 0 = habis)
                        </Text> */}
                      </Text>

                      <View style={styles.inlineRow}>
                        <Text style={styles.inlineLabel}>Ubah kuota</Text>
                        <View style={styles.inlineInputWrap}>
                          <TextInput
                            value={String(h.kuota ?? 0)}
                            onChangeText={(v) => updateKuota(h.id, v)}
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                            keyboardType="default"
                            style={styles.inlineInput}
                          />
                        </View>
                        {/* <Text style={styles.inlineHint}>
                          (- = ∞, 0 = habis)
                        </Text> */}
                      </View>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.trashBtn}
                      onPress={() => remove(h.id)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.saveAllBtn, saving && { opacity: 0.6 }]}
                onPress={saveAll}
                disabled={saving}
              >
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveAllText}>
                  {saving ? "Menyimpan..." : "Simpan Semua Setting"}
                </Text>
              </TouchableOpacity>

              {/* <Text style={styles.note}>
                * Setting ini tersimpan per unit (spin_settings/{branchId})
              </Text> */}
            </>
          )}
        </View>
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
  unitBox: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unitText: {
    fontFamily: F.extrabold,
    color: "#1E40AF",
    fontSize: 13,
  },

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
    color: "#0F172A",
    marginTop: 10,
  },
  subtitle: {
    color: "#64748B",
    lineHeight: 20,
    fontFamily: F.semibold,
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
  cardTitle: { fontSize: 16, fontFamily: F.extrabold, color: "#0F172A" },

  label: { marginTop: 12, fontFamily: F.extrabold, color: "#0F172A" },
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
  input2: { fontSize: 14, color: "#0F172A", fontFamily: F.semibold },

  toggleBtn: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleText: { fontFamily: F.extrabold, color: "#0F172A" },

  hr: {
    height: 1,
    backgroundColor: "rgba(226,232,240,0.95)",
    marginTop: 14,
    marginBottom: 12,
  },

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
  badgeText: { fontFamily: F.extrabold, fontSize: 12, color: "#0F172A" },

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
  primaryText: { color: "white", fontFamily: F.extrabold, fontSize: 15 },

  formBox: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
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
  saveText: { color: "white", fontFamily: F.extrabold },

  item: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  itemTitle: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 15 },
  itemSub: { marginTop: 4, color: "#64748B", fontFamily: F.semibold },

  inlineRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  inlineLabel: { fontFamily: F.extrabold, color: "#0F172A" },
  inlineInputWrap: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    justifyContent: "center",
    minWidth: 90,
  },
  inlineInput: { fontSize: 14, color: "#0F172A", fontFamily: F.bold },
  inlineHint: { color: "#64748B", fontFamily: F.bold },

  trashBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },

  saveAllBtn: {
    marginTop: 14,
    backgroundColor: "#1D4ED8",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveAllText: { color: "white", fontFamily: F.extrabold, fontSize: 15 },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontFamily: F.semibold,
    fontSize: 12,
  },
  unitSelectBox: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  unitSelectLabel: {
    fontFamily: F.extrabold,
    color: "#0F172A",
    marginBottom: 8,
  },
  unitOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  unitOptionActive: {
    backgroundColor: "#DBEAFE",
  },
  unitOptionText: {
    fontFamily: F.bold,
    color: "#0F172A",
  },
  unitDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },

  unitDropdownText: {
    fontFamily: F.bold,
    color: "#0F172A",
    fontSize: 14,
  },

  unitDropdownItem: {
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  unitDropdownItemActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
  },

  unitDropdownItemText: {
    fontFamily: F.bold,
    color: "#0F172A",
  },
});
