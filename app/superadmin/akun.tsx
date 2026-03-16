// FILE: app/superadmin/akun.tsx
// ✅ FULL VERSION — Clean & Professional UI (LOGIC TETAP SAMA + OTA UPDATE)

import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// ✅ OTA Update
import * as Updates from "expo-updates";

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

  // ✅ LOGIC TETAP (dummy user)
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

  // =====================
  // ✅ OTA UPDATE HANDLER
  // =====================
  async function handleUpdateApp() {
    try {
      if (!Updates.isEnabled) {
        Alert.alert(
          "Update Tidak Aktif",
          "Aplikasi ini belum mendukung update otomatis.",
        );
        return;
      }

      const result = await Updates.checkForUpdateAsync();

      if (!result.isAvailable) {
        Alert.alert("Info", "Aplikasi sudah versi terbaru.");
        return;
      }

      Alert.alert(
        "Update Tersedia",
        "Versi terbaru aplikasi ditemukan. Update sekarang?",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Update",
            onPress: async () => {
              await Updates.fetchUpdateAsync();
              await Updates.reloadAsync();
            },
          },
        ],
      );
    } catch (err) {
      console.log("OTA ERROR:", err);
      Alert.alert(
        "Gagal Update",
        "Update tidak tersedia untuk versi aplikasi ini.",
      );
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top + 8, 14),
            paddingBottom: tabH + insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ===== */}
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

        {/* ===== PROFILE CARD ===== */}
        <View style={styles.card}>
          <View style={styles.profileCenter}>
            <View style={styles.avatarLarge}>
              <Ionicons name="person" size={28} color="#1E40AF" />
            </View>
            <Text style={styles.name}>{user.nama}</Text>
            <Text style={styles.role}>{user.role}</Text>
          </View>

          <View style={styles.hr} />

          <InfoLine icon="mail-outline" label="Email" value={user.email} />
          <InfoLine icon="call-outline" label="Telepon" value={user.phone} />
          <InfoLine
            icon="information-circle-outline"
            label="Versi Aplikasi"
            value={user.appVer}
          />
        </View>

        {/* ===== SETTINGS ===== */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pengaturan</Text>

          <ActionRow
            icon="cloud-download-outline"
            title="Update Aplikasi"
            desc="Cek & update aplikasi ke versi terbaru."
            onPress={handleUpdateApp}
          />

          <ActionRow
            icon="key-outline"
            title="Ganti Password"
            desc="Ubah password akun superadmin."
            onPress={() => router.push("/superadmin/ganti-password")}
          />

          <ActionRow
            icon="sync-outline"
            title="Sync Profil"
            desc="Tarik data profil terbaru."
            onPress={() =>
              Alert.alert(
                "Info",
                "Nanti: sinkron akun + ambil data profil dari Firebase/Firestore.",
              )
            }
          />
        </View>

        {/* ===== LOGOUT ===== */}
        <View style={styles.dangerCard}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.logoutBtn}
            onPress={onLogout}
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* ===== SECURITY NOTE ===== */}
        <View style={styles.tipCard}>
          <View style={styles.tipRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#0F172A"
            />
            <Text style={styles.tipTitle}>Tips Keamanan</Text>
          </View>
          <Text style={styles.tipText}>
            Jangan bagikan password ke admin cabang. Gunakan password kuat dan
            rutin ganti setiap 1–3 bulan.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ===================== COMPONENT ===================== */

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
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color="#64748B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  desc,
  onPress,
}: {
  icon: any;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.actionRow}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={18} color="#1E40AF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: IS_SMALL ? 14 : 16,
    gap: 12,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brand: {
    fontFamily: F.extrabold,
    color: "#1D4ED8",
    fontSize: 15,
  },

  brandSub: {
    fontFamily: F.semibold,
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },

  chip: {
    backgroundColor: "rgba(219,234,254,0.95)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
  },

  chipText: {
    fontFamily: F.extrabold,
    fontSize: 12,
    color: "#1E40AF",
  },

  title: {
    fontFamily: F.extrabold,
    fontSize: 22,
    color: "#0F172A",
  },

  subtitle: {
    fontFamily: F.semibold,
    fontSize: 12,
    color: "#64748B",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  profileCenter: {
    alignItems: "center",
  },

  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "rgba(219,234,254,1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
  },

  name: {
    marginTop: 10,
    fontFamily: F.extrabold,
    fontSize: 16,
    color: "#0F172A",
  },

  role: {
    marginTop: 4,
    fontFamily: F.semibold,
    fontSize: 12,
    color: "#64748B",
  },

  hr: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 14,
  },

  infoRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 8,
  },

  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(226,232,240,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  infoLabel: {
    fontFamily: F.semibold,
    fontSize: 11,
    color: "#94A3B8",
  },

  infoValue: {
    fontFamily: F.extrabold,
    fontSize: 13,
    color: "#0F172A",
  },

  sectionTitle: {
    fontFamily: F.extrabold,
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 8,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },

  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "rgba(219,234,254,0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
  },

  actionTitle: {
    fontFamily: F.extrabold,
    fontSize: 13,
    color: "#0F172A",
  },

  actionDesc: {
    marginTop: 2,
    fontFamily: F.bold,
    fontSize: 12,
    color: "#64748B",
  },

  dangerCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  logoutBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  logoutText: {
    fontFamily: F.extrabold,
    fontSize: 14,
    color: "#EF4444",
  },

  tipCard: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  tipTitle: {
    fontFamily: F.extrabold,
    fontSize: 13,
    color: "#0F172A",
  },

  tipText: {
    marginTop: 8,
    fontFamily: F.bold,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
});
