// FILE: app/superadmin/akun.tsx
// ✅ FULL VERSION — UI lebih compact (tidak kebesaran), logika tetap sama

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
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

const { width: W } = Dimensions.get("window");
const IS_SMALL = W < 380;

export default function SuperadminAkun() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  // ✅ logika tetap: masih dummy user
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
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: tabH + insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>SPP Mobile</Text>
            <Text style={styles.brandSub}>Akun Superadmin</Text>
          </View>

          <View style={styles.chip}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color="#1E40AF"
            />
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
              <Ionicons name="person" size={20} color="#1E40AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {user.nama}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {user.role}
              </Text>
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
            * UI dibuat lebih compact, data asli nanti dari Firebase.
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

        <View style={{ height: 10 }} />
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
        <Text style={styles.lineValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: IS_SMALL ? 14 : 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
  },

  header: {
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontFamily: F.extrabold,
    color: "#1D4ED8",
    letterSpacing: 0.2,
    fontSize: IS_SMALL ? 14 : 15,
  },
  brandSub: {
    marginTop: 2,
    fontFamily: F.semibold,
    color: "#64748B",
    fontSize: 12,
  },

  chip: {
    backgroundColor: "rgba(219,234,254,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { color: "#1E40AF", fontFamily: F.extrabold, fontSize: 12 },

  title: {
    fontSize: IS_SMALL ? 20 : 22,
    fontFamily: F.extrabold,
    color: "#0F172A",
    marginTop: 2,
  },
  subtitle: {
    color: "#64748B",
    lineHeight: 18,
    fontFamily: F.semibold,
    marginTop: 2,
    fontSize: 12,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },
  cardSoft: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },

  avatarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 15 },
  sub: { marginTop: 2, color: "#64748B", fontFamily: F.bold, fontSize: 12 },

  hr: {
    height: 1,
    backgroundColor: "rgba(226,232,240,0.95)",
    marginTop: 12,
    marginBottom: 8,
  },
  hr2: {
    height: 1,
    backgroundColor: "rgba(226,232,240,0.95)",
    marginTop: 10,
    marginBottom: 10,
  },

  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  lineIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(226,232,240,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  lineLabel: { color: "#64748B", fontFamily: F.extrabold, fontSize: 12 },
  lineValue: {
    marginTop: 2,
    color: "#0F172A",
    fontFamily: F.extrabold,
    fontSize: 13,
  },

  sectionTitle: {
    marginTop: 2,
    fontFamily: F.extrabold,
    color: "#0F172A",
    fontSize: 13,
  },

  actionRow: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "rgba(219,234,254,0.95)",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 13 },
  actionDesc: {
    marginTop: 2,
    color: "#64748B",
    fontFamily: F.bold,
    fontSize: 12,
    lineHeight: 16,
  },

  logoutBtn: {
    marginTop: 12,
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: { color: "white", fontFamily: F.extrabold, fontSize: 14 },

  note: {
    marginTop: 10,
    textAlign: "center",
    color: "#94A3B8",
    fontFamily: F.semibold,
    fontSize: 12,
  },

  tipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipTitle: { fontFamily: F.extrabold, color: "#0F172A", fontSize: 13 },
  tipText: {
    marginTop: 8,
    color: "#475569",
    fontFamily: F.bold,
    lineHeight: 18,
    fontSize: 12,
  },
});
