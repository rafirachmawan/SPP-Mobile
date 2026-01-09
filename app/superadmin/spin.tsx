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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// ✅ Firebase
import { auth, db } from "../../firebase"; // sesuaikan path
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

type Hadiah = { id: string; label: string; nominal: number; peluang: number };

const DOC_PATH = { col: "spin_settings", id: "global" };

function toInt(v: string, fallback = 0) {
  const n = Number(String(v || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export default function SpinSettingPage() {
  // ===== default dummy kalau belum ada data di Firestore =====
  const dummyHadiah = useMemo<Hadiah[]>(
    () => [
      { id: "H1", label: "Potongan 10.000", nominal: 10000, peluang: 35 },
      { id: "H2", label: "Potongan 20.000", nominal: 20000, peluang: 25 },
      { id: "H3", label: "Potongan 50.000", nominal: 50000, peluang: 10 },
      { id: "H4", label: "Zonk", nominal: 0, peluang: 30 },
    ],
    []
  );

  const [items, setItems] = useState<Hadiah[]>(dummyHadiah);
  const [showForm, setShowForm] = useState(false);

  const [label, setLabel] = useState("");
  const [nominal, setNominal] = useState("");
  const [peluang, setPeluang] = useState("");

  const [sebelumTanggal, setSebelumTanggal] = useState("11");
  const [dipakaiBulanDepan, setDipakaiBulanDepan] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () => items.reduce((a, b) => a + (b.peluang || 0), 0),
    [items]
  );

  // ===================== LOAD dari Firestore =====================
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as any;

          const st = String(data.sebelumTanggal ?? "11");
          const dipakai = data.dipakaiBulanDepan !== false;

          const hadiahRaw = Array.isArray(data.hadiah) ? data.hadiah : [];
          const hadiah: Hadiah[] =
            hadiahRaw.length > 0
              ? hadiahRaw.map((h: any, idx: number) => ({
                  id: String(h.id || `H${idx + 1}`),
                  label: String(h.label || ""),
                  nominal: Number(h.nominal || 0),
                  peluang: Number(h.peluang || 0),
                }))
              : dummyHadiah;

          setSebelumTanggal(st);
          setDipakaiBulanDepan(dipakai);
          setItems(hadiah);
        }
      } catch (e: any) {
        console.log(e);
        Alert.alert("Gagal", "Tidak bisa memuat setting spin.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addHadiah() {
    const l = label.trim();
    const n = toInt(nominal, 0);
    const p = toInt(peluang, 0);

    if (!l) return Alert.alert("Gagal", "Nama hadiah wajib diisi.");
    if (!Number.isFinite(n) || n < 0)
      return Alert.alert("Gagal", "Nominal tidak valid.");
    if (!Number.isFinite(p) || p <= 0)
      return Alert.alert("Gagal", "Peluang harus > 0.");

    setItems((prev) => [
      { id: `H${Date.now()}`, label: l, nominal: n, peluang: p },
      ...prev,
    ]);

    setLabel("");
    setNominal("");
    setPeluang("");
    setShowForm(false);
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function saveAll() {
    const tgl = toInt(sebelumTanggal, 11);

    if (tgl < 1 || tgl > 31)
      return Alert.alert("Gagal", "Tanggal harus 1 - 31.");

    if (items.length === 0)
      return Alert.alert("Gagal", "Minimal harus ada 1 hadiah.");

    // ✅ aturan peluang: kamu bisa pilih mau wajib 100 atau warning
    if (total !== 100) {
      return Alert.alert(
        "Total peluang belum 100%",
        `Sekarang total: ${total}%.\n\nBiar adil, idealnya 100%.`,
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Tetap Simpan",
            onPress: () => doSave(tgl),
          },
        ]
      );
    }

    return doSave(tgl);
  }

  async function doSave(tgl: number) {
    try {
      setSaving(true);

      const ref = doc(db, DOC_PATH.col, DOC_PATH.id);

      await setDoc(
        ref,
        {
          sebelumTanggal: tgl,
          dipakaiBulanDepan,
          hadiah: items.map((h) => ({
            id: h.id,
            label: h.label,
            nominal: Number(h.nominal || 0),
            peluang: Number(h.peluang || 0),
          })),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid || null,
        },
        { merge: true }
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
          title="Hadiah Spin"
          subtitle="Atur hadiah, peluang, dan aturan spin."
        />

        <View style={styles.card}>
          {loading ? (
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
                      onChangeText={setNominal}
                      placeholder="10000"
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
                        Peluang: {h.peluang}%
                      </Text>
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

              <Text style={styles.note}>
                * Setting ini tersimpan di Firestore: spin_settings/global
              </Text>
            </>
          )}
        </View>

        <View style={{ height: 12 }} />
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

  label: { marginTop: 12, fontWeight: "900", color: "#0F172A" },
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
  toggleText: { fontWeight: "900", color: "#0F172A" },

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
  badgeText: { fontWeight: "900", fontSize: 12, color: "#0F172A" },

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
    alignItems: "center",
  },
  itemTitle: { fontWeight: "900", color: "#0F172A", fontSize: 15 },
  itemSub: { marginTop: 4, color: "#64748B", fontWeight: "700" },

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
  saveAllText: { color: "white", fontWeight: "900", fontSize: 15 },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
  },
});
