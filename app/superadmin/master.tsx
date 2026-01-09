import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const THEME = {
  bg1: "#BFE9FF",
  bg2: "#EAF6FF",
  bg3: "#F7FBFF",
  text: "#0F172A",
  sub: "#64748B",
  border: "#E2E8F0",
  card: "rgba(255,255,255,0.92)",
};

export default function MasterMenu() {
  const router = useRouter();

  // ✅ Setting SPP dihapus dari Master (karena sudah disetting saat bikin siswa)
  const items = [
    {
      title: "Tambah / Kelola Cabang",
      desc: "Buat cabang baru & kelola data cabang.",
      icon: "business-outline",
      href: "/superadmin/cabang",
    },
    {
      title: "Tambah / Kelola Admin Cabang",
      desc: "Buat user admin untuk tiap cabang.",
      icon: "people-outline",
      href: "/superadmin/admin-cabang",
    },
    {
      title: "Setting Hadiah Spin",
      desc: "Atur daftar hadiah & peluang spin.",
      icon: "gift-outline",
      href: "/superadmin/spin",
    },

    // ✅ BARU: TAMBAH / KELOLA SISWA (INPUT SISWA PER CABANG)
    {
      title: "Tambah / Kelola Siswa",
      desc: "Tambah siswa berdasarkan cabang & kelola daftar siswa.",
      icon: "person-add-outline",
      href: "/superadmin/tambah-siswa",
    },

    // tetap ada: lihat siswa per cabang
    {
      title: "Lihat Siswa per Cabang",
      desc: "Cek daftar siswa berdasarkan cabang.",
      icon: "school-outline",
      href: "/superadmin/siswa",
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[THEME.bg1, THEME.bg2, THEME.bg3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Menu Master</Text>
        <Text style={styles.subtitle}>Kelola fitur utama Superadmin.</Text>

        <View style={styles.card}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.href}
              activeOpacity={0.9}
              onPress={() => router.push(it.href as any)}
              style={styles.rowBtn}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={it.icon as any} size={18} color="#1D4ED8" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{it.title}</Text>
                <Text style={styles.rowDesc}>{it.desc}</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.noteCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#0F172A"
          />
          <Text style={styles.noteText}>
            Pastikan rules Firestore sudah mengizinkan SUPERADMIN mengelola data
            (branches, branch_admins, students, spin_settings, dll).
          </Text>
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: THEME.text,
  },
  subtitle: {
    marginTop: 8,
    color: THEME.sub,
    fontWeight: "700",
    lineHeight: 20,
    maxWidth: 330,
  },
  card: {
    marginTop: 14,
    backgroundColor: THEME.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    padding: 12,
  },
  rowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    marginBottom: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontWeight: "900",
    color: THEME.text,
  },
  rowDesc: {
    marginTop: 2,
    color: THEME.sub,
    fontWeight: "700",
    fontSize: 12,
  },
  noteCard: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    borderRadius: 16,
    padding: 12,
  },
  noteText: {
    flex: 1,
    color: "#475569",
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
  },
});
