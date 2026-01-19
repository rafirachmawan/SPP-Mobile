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
  branchId: string; // cabangId/branchId diseragamkan ke branchId
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
          // kalau belum login, lempar ke login
          if (mounted) router.replace("/login");
          return;
        }

        // ambil data user
        const uRef = doc(db, "users", u.uid);
        const uSnap = await getDoc(uRef);

        if (!uSnap.exists()) {
          Alert.alert("Gagal", "Data user tidak ditemukan di users.");
          if (mounted) router.replace("/login");
          return;
        }

        const data = uSnap.data() as any;

        // aturan umum
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

        // ambil nama cabang
        if (branchId) {
          const bRef = doc(db, "branches", branchId);
          const bSnap = await getDoc(bRef);
          if (bSnap.exists()) {
            const b = bSnap.data() as any;
            if (mounted) setBranchName(String(b.name || "-").trim() || "-");
          } else {
            if (mounted) setBranchName("-");
          }
        } else {
          if (mounted) setBranchName("-");
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
    // admin cabang kamu dibuat pakai email internal: `${username}@cabang.spp`
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
          } catch (e) {
            // ignore
          } finally {
            router.replace("/login");
          }
        },
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
            paddingTop: Math.max(insets.top + 8, 14),
            paddingBottom: tabH + insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Shining Sun 🎈</Text>
            <Text style={styles.brandSub}>Akun Admin</Text>
          </View>

          <View style={styles.chip}>
            <Ionicons name="person-circle-outline" size={14} color="#1E40AF" />
            <Text style={styles.chipText}>Akun</Text>
          </View>
        </View>

        <Text style={styles.title}>Akun Admin</Text>
        <Text style={styles.subtitle}>
          Informasi akun admin yang sedang login.
        </Text>

        <View style={styles.card}>
          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <ActivityIndicator />
              <Text style={[styles.note, { marginTop: 8 }]}>
                Memuat akun...
              </Text>
            </View>
          ) : !profile ? (
            <Text style={styles.note}>Akun tidak ditemukan.</Text>
          ) : (
            <>
              <View style={styles.avatarRow}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={20} color="#1E40AF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {profile.nama}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {roleLabel} • {branchName}
                  </Text>
                </View>
              </View>

              <View style={styles.hr} />

              <InfoLine icon="mail-outline" value={emailInternal} />
              <InfoLine
                icon="person-circle-outline"
                value={`@${profile.username || "-"}`}
              />
              <InfoLine icon="location-outline" value={branchName} />
              <InfoLine icon="shield-checkmark-outline" value={roleLabel} />

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.logoutBtn}
                onPress={onLogout}
              >
                <Ionicons name="log-out-outline" size={18} color="#fff" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>

              {/* <Text style={styles.note}>
                * Data diambil dari Firestore (users/{profile.uid} + branches/
                {profile.branchId || "-"}).
              </Text> */}
            </>
          )}
        </View>

        <View style={{ height: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoLine({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={styles.line}>
      <View style={styles.lineIcon}>
        <Ionicons name={icon} size={16} color="#64748B" />
      </View>
      <Text style={styles.lineText} numberOfLines={1}>
        {value}
      </Text>
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
  },
  subtitle: {
    color: "#64748B",
    lineHeight: 18,
    fontFamily: F.semibold,
    fontSize: 12,
    marginTop: 2,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
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
    marginBottom: 10,
  },

  line: {
    flexDirection: "row",
    alignItems: "center",
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
  lineText: {
    flex: 1,
    color: "#0F172A",
    fontFamily: F.extrabold,
    fontSize: 13,
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
    lineHeight: 16,
  },
});
