import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Student = {
  id: string;
  name: string;
  cabang: string;
  tipe: "Normal" | "Beasiswa 0" | "Beasiswa 100" | "Pertemuan (8x)";
  sppDefault: number;
  override?: number | null;
};

type TabKey = "global" | "tipe" | "siswa";

export default function SettingSppPage() {
  // ✅ dummy siswa lintas cabang (nanti dari database)
  const siswa = useMemo<Student[]>(
    () => [
      {
        id: "S1",
        name: "ANAK A",
        cabang: "Cabang A",
        tipe: "Normal",
        sppDefault: 200000,
      },
      {
        id: "S2",
        name: "ANAK B",
        cabang: "Cabang A",
        tipe: "Beasiswa 0",
        sppDefault: 0,
      },
      {
        id: "S3",
        name: "ANAK C",
        cabang: "Cabang B",
        tipe: "Pertemuan (8x)",
        sppDefault: 150000,
      },
      {
        id: "S4",
        name: "ANAK D",
        cabang: "Cabang C",
        tipe: "Beasiswa 100",
        sppDefault: 100000,
      },
      {
        id: "S5",
        name: "ANAK E",
        cabang: "Cabang C",
        tipe: "Normal",
        sppDefault: 200000,
      },
    ],
    []
  );

  const [tab, setTab] = useState<TabKey>("global");

  // Global
  const [sppGlobal, setSppGlobal] = useState("200000");

  // Per tipe
  const [sppNormal, setSppNormal] = useState("200000");
  const [sppPertemuan8, setSppPertemuan8] = useState("150000");
  const [beasiswa100, setBeasiswa100] = useState("100000");

  // Per siswa (override)
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [override, setOverride] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return siswa;
    return siswa.filter(
      (x) =>
        x.name.toLowerCase().includes(qq) || x.cabang.toLowerCase().includes(qq)
    );
  }, [q, siswa]);

  function onSaveGlobal() {
    Alert.alert(
      "Tersimpan (dummy)",
      `SPP Global = Rp ${Number(sppGlobal || 0).toLocaleString("id-ID")}`
    );
  }

  function onSaveTipe() {
    Alert.alert(
      "Tersimpan (dummy)",
      `SPP Normal: Rp ${Number(sppNormal || 0).toLocaleString(
        "id-ID"
      )}\nPertemuan (8x): Rp ${Number(sppPertemuan8 || 0).toLocaleString(
        "id-ID"
      )}\nBeasiswa 100: Rp ${Number(beasiswa100 || 0).toLocaleString(
        "id-ID"
      )}\nBeasiswa 0: Rp 0`
    );
  }

  function onPickStudent(s: Student) {
    setSelected(s);
    setOverride(String(s.override ?? ""));
  }

  function onSaveOverride() {
    if (!selected) return;
    Alert.alert(
      "Tersimpan (dummy)",
      `Override SPP untuk ${selected.name} = ${
        override
          ? `Rp ${Number(override).toLocaleString("id-ID")}`
          : "hapus override (pakai default)"
      }`
    );
  }

  function onClearOverride() {
    setOverride("");
    Alert.alert("OK", "Override dihapus (dummy).");
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
          title="Setting SPP"
          subtitle="Atur SPP global, per tipe, dan per siswa."
        />

        {/* Tabs */}
        <View style={styles.tabs}>
          <TabBtn
            active={tab === "global"}
            label="Global"
            onPress={() => setTab("global")}
          />
          <TabBtn
            active={tab === "tipe"}
            label="Per Tipe"
            onPress={() => setTab("tipe")}
          />
          <TabBtn
            active={tab === "siswa"}
            label="Per Siswa"
            onPress={() => setTab("siswa")}
          />
        </View>

        {/* Content */}
        {tab === "global" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SPP Global (Default)</Text>
            <Text style={styles.cardSub}>
              Ini dipakai untuk semua siswa normal jika tidak ada setting
              khusus.
            </Text>

            <Text style={styles.label}>Nominal SPP Global</Text>
            <View style={styles.inputWrap2}>
              <TextInput
                value={sppGlobal}
                onChangeText={setSppGlobal}
                keyboardType="number-pad"
                placeholder="200000"
                placeholderTextColor="#94A3B8"
                style={styles.input2}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.saveAllBtn}
              onPress={onSaveGlobal}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveAllText}>Simpan SPP Global</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === "tipe" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SPP Per Tipe Siswa</Text>
            <Text style={styles.cardSub}>
              Aturan ini dipakai sesuai tipe siswa.
            </Text>

            <Text style={styles.label}>Normal</Text>
            <View style={styles.inputWrap2}>
              <TextInput
                value={sppNormal}
                onChangeText={setSppNormal}
                keyboardType="number-pad"
                placeholder="200000"
                placeholderTextColor="#94A3B8"
                style={styles.input2}
              />
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>
              Pertemuan (8x)
            </Text>
            <View style={styles.inputWrap2}>
              <TextInput
                value={sppPertemuan8}
                onChangeText={setSppPertemuan8}
                keyboardType="number-pad"
                placeholder="150000"
                placeholderTextColor="#94A3B8"
                style={styles.input2}
              />
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Beasiswa 100</Text>
            <View style={styles.inputWrap2}>
              <TextInput
                value={beasiswa100}
                onChangeText={setBeasiswa100}
                keyboardType="number-pad"
                placeholder="100000"
                placeholderTextColor="#94A3B8"
                style={styles.input2}
              />
            </View>

            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#0F172A"
              />
              <Text style={styles.infoText}>Beasiswa 0 otomatis = Rp 0.</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.saveAllBtn}
              onPress={onSaveTipe}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveAllText}>Simpan Setting Tipe</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === "siswa" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Override SPP Per Siswa</Text>
            <Text style={styles.cardSub}>
              Cari siswa lalu set nominal khusus (jika perlu).
            </Text>

            <View style={styles.inputWrap}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Cari nama / cabang..."
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
              <View style={styles.rightIcon}>
                <Ionicons name="search-outline" size={18} color="#64748B" />
              </View>
            </View>

            <View style={{ marginTop: 12, gap: 10 }}>
              {filtered.slice(0, 10).map((s) => {
                const active = selected?.id === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    activeOpacity={0.9}
                    style={[styles.item, active && styles.itemActive]}
                    onPress={() => onPickStudent(s)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{s.name}</Text>
                      <Text style={styles.itemSub}>
                        {s.cabang} • {s.tipe}
                      </Text>
                      <Text style={styles.itemSub2}>
                        Default: Rp {s.sppDefault.toLocaleString("id-ID")}
                        {s.override != null
                          ? ` • Override: Rp ${Number(
                              s.override
                            ).toLocaleString("id-ID")}`
                          : ""}
                      </Text>
                    </View>
                    <Ionicons
                      name={active ? "checkmark-circle" : "chevron-forward"}
                      size={22}
                      color={active ? "#16A34A" : "#94A3B8"}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {selected ? (
              <View style={styles.formBox}>
                <Text style={styles.label}>Siswa terpilih</Text>
                <Text style={styles.pickName}>{selected.name}</Text>
                <Text style={styles.pickSub}>
                  {selected.cabang} • {selected.tipe}
                </Text>

                <Text style={[styles.label, { marginTop: 12 }]}>
                  Nominal Override (kosongkan untuk hapus override)
                </Text>
                <View style={styles.inputWrap2}>
                  <TextInput
                    value={override}
                    onChangeText={setOverride}
                    keyboardType="number-pad"
                    placeholder="contoh: 180000"
                    placeholderTextColor="#94A3B8"
                    style={styles.input2}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={[styles.saveBtn, { flex: 1 }]}
                    onPress={onSaveOverride}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.saveText}>Simpan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={[styles.dangerBtn, { width: 120 }]}
                    onPress={onClearOverride}
                  >
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.dangerText}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.helperCard}>
                <Text style={styles.helperText}>
                  Pilih salah satu siswa untuk mengatur override.
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.note}>* Semua setting masih dummy (UI saja).</Text>
        <View style={{ height: 12 }} />
      </ScrollView>
    </View>
  );
}

function TabBtn({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.tabBtn, active ? styles.tabActive : styles.tabNormal]}
    >
      <Text style={[styles.tabText, active && { color: "#0F172A" }]}>
        {label}
      </Text>
    </TouchableOpacity>
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

  tabs: { flexDirection: "row", gap: 8, marginTop: 6 },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: "#DBEAFE", borderColor: "#BFDBFE" },
  tabNormal: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "rgba(226,232,240,0.95)",
  },
  tabText: { fontWeight: "900", color: "#64748B" },

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
  cardSub: {
    marginTop: 6,
    color: "#64748B",
    fontWeight: "700",
    lineHeight: 18,
  },

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

  infoBox: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: { color: "#0F172A", fontWeight: "800" },

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
  itemActive: { borderColor: "#86EFAC", backgroundColor: "#F0FDF4" },
  itemTitle: { fontWeight: "900", color: "#0F172A", fontSize: 15 },
  itemSub: { marginTop: 4, color: "#64748B", fontWeight: "700" },
  itemSub2: { marginTop: 6, color: "#94A3B8", fontWeight: "700" },

  formBox: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  pickName: { marginTop: 6, fontWeight: "900", color: "#0F172A", fontSize: 16 },
  pickSub: { marginTop: 4, color: "#64748B", fontWeight: "700" },

  saveBtn: {
    backgroundColor: "#16A34A",
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: "white", fontWeight: "900" },

  dangerBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  dangerText: { color: "white", fontWeight: "900" },

  helperCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  helperText: { textAlign: "center", color: "#64748B", fontWeight: "800" },

  note: {
    marginTop: 2,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
  },
});
