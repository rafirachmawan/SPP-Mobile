// FILE: app/superadmin/akun.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// 🎨 Font Map (Inter)
const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

export default function SuperadminAkun() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  const user = {
    nama: "Super Admin",
    email: "superadmin@spp.com",
    role: "SUPERADMIN",
    phone: "08xx-xxxx-xxxx",
    appVer: "1.0.0",
  };

  function onLogout() {
    Alert.alert("Logout", "Keluar dari akun superadmin?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: () => router.replace("/login"),
      },
    ]);
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
            paddingTop: Math.max(insets.top, 14),
            paddingBottom: tabH + insets.bottom + 18,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>SPP Mobile</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Superadmin</Text>
          </View>
        </View>

        <Text style={styles.title}>Akun</Text>
        <Text style={styles.subtitle}>
          Informasi akun superadmin yang sedang login.
        </Text>

        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={22} color="#1E40AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{user.nama}</Text>
              <Text style={styles.sub}>{user.role}</Text>
            </View>
          </View>

          <View style={styles.hr} />

          <InfoLine icon="mail-outline" label="Email" value={user.email} />
          <InfoLine icon="call-outline" label="Telepon" value={user.phone} />
          <InfoLine
            icon="information-circle-outline"
            label="Versi Aplikasi"
            value={user.appVer}
          />

          <View style={styles.hr2} />

          <Text style={styles.sectionTitle}>Pengaturan</Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.actionRow}
            onPress={() =>
              Alert.alert("Info", "Nanti: ganti password (Firebase).")
            }
          >
            <View style={styles.actionIcon}>
              <Ionicons name="key-outline" size={18} color="#1E40AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Ganti Password</Text>
              <Text style={styles.actionDesc}>
                Ubah password akun superadmin.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.actionRow}
            onPress={() =>
              Alert.alert(
                "Info",
                "Nanti: sinkron akun + ambil data profil dari Firebase/Firestore."
              )
            }
          >
            <View style={styles.actionIcon}>
              <Ionicons name="sync-outline" size={18} color="#1E40AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Sync Profil</Text>
              <Text style={styles.actionDesc}>Tarik data profil terbaru.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.logoutBtn}
            onPress={onLogout}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            * UI dibuat lebih “penuh”, data asli nanti dari Firebase.
          </Text>
        </View>

        <View style={styles.cardSoft}>
          <View style={styles.tipRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#0F172A"
            />
            <Text style={styles.tipTitle}>Tips Keamanan</Text>
          </View>
          <Text style={styles.tipText}>
            Jangan bagikan password ke admin cabang. Aktifkan kebijakan password
            kuat dan rutin ganti password tiap 1–3 bulan.
          </Text>
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.lineRow}>
      <View style={styles.lineIcon}>
        <Ionicons name={icon} size={16} color="#64748B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineLabel}>{label}</Text>
        <Text style={styles.lineValue}>{value}</Text>
      </View>
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
    color: "#0F172A",
    marginTop: 8,
  },
  subtitle: {
    color: "#64748B",
    lineHeight: 20,
    fontFamily: F.semibold,
    marginTop: 4,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  cardSoft: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },

  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 16 },
  sub: { marginTop: 4, color: "#64748B", fontFamily: F.bold },

  hr: {
    height: 1,
    backgroundColor: "rgba(226,232,240,0.95)",
    marginTop: 14,
    marginBottom: 10,
  },
  hr2: {
    height: 1,
    backgroundColor: "rgba(226,232,240,0.95)",
    marginTop: 12,
    marginBottom: 12,
  },

  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
  },
  lineIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(226,232,240,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  lineLabel: { color: "#64748B", fontFamily: F.extrabold, fontSize: 12 },
  lineValue: { marginTop: 2, color: "#0F172A", fontFamily: F.extrabold },

  sectionTitle: { marginTop: 2, fontFamily: F.extrabold, color: "#0F172A" },

  actionRow: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontFamily: F.extrabold, color: "#0F172A" },
  actionDesc: {
    marginTop: 2,
    color: "#64748B",
    fontFamily: F.bold,
    fontSize: 12,
  },

  logoutBtn: {
    marginTop: 14,
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: { color: "white", fontFamily: F.extrabold, fontSize: 15 },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontFamily: F.semibold,
    fontSize: 12,
  },

  tipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipTitle: { fontFamily: F.extrabold, color: "#0F172A" },
  tipText: {
    marginTop: 8,
    color: "#475569",
    fontFamily: F.bold,
    lineHeight: 18,
  },
});
