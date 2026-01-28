import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

// ✅ Firebase
import { signOut as signOutAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";

// ✅ OTA Update
import * as Updates from "expo-updates";

// ✅ Inter font map
const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

type Profile = {
  uid: string;
  nama: string;
  username: string;
  role: string;
  active: boolean;
  branchId: string;
};

const { width: W } = Dimensions.get("window");
const IS_SMALL = W < 380;

export default function TabAkun() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabH = useBottomTabBarHeight();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branchName, setBranchName] = useState<string>("-");

  // ===================== LOAD PROFILE USER LOGIN =====================
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const u = auth.currentUser;
        if (!u) {
          if (mounted) router.replace("/login");
          return;
        }

        const uRef = doc(db, "users", u.uid);
        const uSnap = await getDoc(uRef);

        if (!uSnap.exists()) {
          Alert.alert("Gagal", "Data user tidak ditemukan di users.");
          if (mounted) router.replace("/login");
          return;
        }

        const data = uSnap.data() as any;

        const active = data.active !== false;
        if (!active) {
          Alert.alert("Akun Nonaktif", "Akun kamu sedang dinonaktifkan.");
          await signOutAuth(auth).catch(() => {});
          if (mounted) router.replace("/login");
          return;
        }

        const branchId = String(data.cabangId || data.branchId || "").trim();

        const prof: Profile = {
          uid: u.uid,
          nama: String(data.nama || data.name || "Admin").trim(),
          username: String(data.username || "").trim(),
          role: String(data.role || "").trim(),
          active,
          branchId,
        };

        if (mounted) setProfile(prof);

        if (branchId) {
          const bRef = doc(db, "branches", branchId);
          const bSnap = await getDoc(bRef);
          if (mounted) {
            setBranchName(
              bSnap.exists() ? String(bSnap.data()?.name || "-").trim() : "-",
            );
          }
        }
      } catch (e: any) {
        console.log(e);
        Alert.alert("Gagal", e?.message || "Tidak bisa memuat data akun.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const emailInternal = useMemo(() => {
    if (!profile?.username) return "-";
    return `${profile.username}@cabang.spp`;
  }, [profile]);

  const roleLabel = useMemo(() => {
    const r = String(profile?.role || "").toUpperCase();
    if (r === "ADMIN_CABANG") return "Admin Cabang";
    if (r === "SUPERADMIN") return "Superadmin";
    if (r === "SISWA") return "Siswa";
    return r || "-";
  }, [profile]);

  async function onLogout() {
    Alert.alert("Logout", "Keluar dari akun?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          try {
            await signOutAuth(auth);
          } catch {}
          router.replace("/login");
        },
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
        <Text style={styles.pageTitle}>Akun Admin</Text>
        <Text style={styles.subtitle}>
          Informasi akun admin yang sedang login
        </Text>

        {/* ================= PROFILE CARD ================= */}
        <View style={styles.card}>
          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <ActivityIndicator />
              <Text style={styles.note}>Memuat akun...</Text>
            </View>
          ) : !profile ? (
            <Text style={styles.note}>Akun tidak ditemukan.</Text>
          ) : (
            <>
              <View style={styles.profileCard}>
                <View style={styles.avatarLarge}>
                  <Ionicons name="person" size={26} color="#1E40AF" />
                </View>
                <Text style={styles.profileName}>{profile.nama}</Text>
                <Text style={styles.profileSub}>
                  {roleLabel} • {branchName}
                </Text>
              </View>

              <View style={styles.divider} />

              <DetailItem
                icon="mail-outline"
                label="Email Internal"
                value={emailInternal}
              />
              <DetailItem
                icon="person-outline"
                label="Username"
                value={`@${profile.username}`}
              />
              <DetailItem
                icon="shield-checkmark-outline"
                label="Role"
                value={roleLabel}
              />
              <DetailItem
                icon="location-outline"
                label="Cabang"
                value={branchName}
              />
            </>
          )}
        </View>

        {/* ================= SETTINGS ================= */}
        {!loading && profile && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pengaturan</Text>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.actionRow}
              onPress={handleUpdateApp}
            >
              <View style={styles.actionIcon}>
                <Ionicons
                  name="cloud-download-outline"
                  size={18}
                  color="#1E40AF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Update Aplikasi</Text>
                <Text style={styles.actionDesc}>
                  Cek & update aplikasi ke versi terbaru
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}

        {/* ================= LOGOUT ================= */}
        {!loading && profile && (
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ===================== COMPONENT =====================
function DetailItem({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={18} color="#64748B" />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ===================== STYLES =====================
const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: IS_SMALL ? 14 : 16,
    gap: 10,
  },

  pageTitle: {
    fontFamily: F.extrabold,
    fontSize: 22,
    color: "#0F172A",
  },

  subtitle: {
    color: "#64748B",
    fontFamily: F.semibold,
    fontSize: 12,
    marginBottom: 12,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
  },

  profileCard: {
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

  profileName: {
    marginTop: 10,
    fontFamily: F.extrabold,
    fontSize: 16,
    color: "#0F172A",
  },

  profileSub: {
    marginTop: 4,
    fontFamily: F.semibold,
    fontSize: 12,
    color: "#64748B",
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(226,232,240,0.95)",
    marginVertical: 14,
  },

  detailItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 10,
  },

  detailLabel: {
    fontFamily: F.semibold,
    fontSize: 11,
    color: "#94A3B8",
  },

  detailValue: {
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
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  logoutText: {
    fontFamily: F.extrabold,
    fontSize: 14,
    color: "#EF4444",
  },

  note: {
    textAlign: "center",
    color: "#94A3B8",
    fontFamily: F.semibold,
    fontSize: 12,
  },
});
