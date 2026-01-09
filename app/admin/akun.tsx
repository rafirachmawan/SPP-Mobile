import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function TabAkun() {
  const router = useRouter();

  // ✅ dummy data (nanti ambil dari Firebase session)
  const admin = {
    nama: "Admin Cabang",
    cabang: "Shining Sun - Cabang A",
    email: "admin@shiningsun.com",
  };

  function onLogout() {
    Alert.alert("Logout", "Keluar dari akun?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: () => router.replace("/login"),
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brand}>Shining Sun 🎈</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Akun</Text>
          </View>
        </View>

        <Text style={styles.title}>Akun Admin</Text>
        <Text style={styles.subtitle}>
          Informasi akun admin yang sedang login.
        </Text>

        <View style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={22} color="#1E40AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{admin.nama}</Text>
              <Text style={styles.sub}>{admin.cabang}</Text>
            </View>
          </View>

          <View style={styles.hr} />

          <View style={styles.line}>
            <Ionicons name="mail-outline" size={18} color="#64748B" />
            <Text style={styles.lineText}>{admin.email}</Text>
          </View>

          <View style={styles.line}>
            <Ionicons name="location-outline" size={18} color="#64748B" />
            <Text style={styles.lineText}>{admin.cabang}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.logoutBtn}
            onPress={onLogout}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            * Nanti data akun (cabang/role) diambil dari Firebase login admin.
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
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },

  header: {
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontWeight: "900", color: "#1D4ED8" },
  chip: {
    backgroundColor: "rgba(219,234,254,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
  },
  chipText: { color: "#1E40AF", fontWeight: "900", fontSize: 12 },

  title: { fontSize: 26, fontWeight: "900", color: "#0F172A" },
  subtitle: { color: "#64748B", lineHeight: 20, fontWeight: "700" },

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

  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontWeight: "900", color: "#0F172A", fontSize: 16 },
  sub: { marginTop: 4, color: "#64748B", fontWeight: "700" },

  hr: {
    height: 1,
    backgroundColor: "rgba(226,232,240,0.95)",
    marginTop: 14,
    marginBottom: 12,
  },

  line: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  lineText: { color: "#0F172A", fontWeight: "800" },

  logoutBtn: {
    marginTop: 16,
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: { color: "white", fontWeight: "900", fontSize: 15 },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
  },
});
