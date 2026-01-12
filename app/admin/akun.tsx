import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// ✅ Firebase
import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut as signOutAuth } from "firebase/auth";

type Profile = {
  uid: string;
  nama: string;
  username: string;
  role: string;
  active: boolean;
  branchId: string; // cabangId/branchId diseragamkan ke branchId
};

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
            paddingTop: Math.max(insets.top + 8, 18),
            paddingBottom: tabH + 18,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 18 }}>
              <ActivityIndicator />
              <Text style={[styles.note, { marginTop: 10 }]}>
                Memuat akun...
              </Text>
            </View>
          ) : !profile ? (
            <Text style={styles.note}>Akun tidak ditemukan.</Text>
          ) : (
            <>
              <View style={styles.avatarRow}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={22} color="#1E40AF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{profile.nama}</Text>
                  <Text style={styles.sub}>
                    {roleLabel} • {branchName}
                  </Text>
                </View>
              </View>

              <View style={styles.hr} />

              <View style={styles.line}>
                <Ionicons name="mail-outline" size={18} color="#64748B" />
                <Text style={styles.lineText}>{emailInternal}</Text>
              </View>

              <View style={styles.line}>
                <Ionicons
                  name="person-circle-outline"
                  size={18}
                  color="#64748B"
                />
                <Text style={styles.lineText}>@{profile.username || "-"}</Text>
              </View>

              <View style={styles.line}>
                <Ionicons name="location-outline" size={18} color="#64748B" />
                <Text style={styles.lineText}>{branchName}</Text>
              </View>

              <View style={styles.line}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color="#64748B"
                />
                <Text style={styles.lineText}>{roleLabel}</Text>
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
                * Data diambil dari Firestore (users/{profile.uid} + branches/
                {profile.branchId || "-"}).
              </Text>
            </>
          )}
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>
    </SafeAreaView>
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
  lineText: { color: "#0F172A", fontWeight: "900" },

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
