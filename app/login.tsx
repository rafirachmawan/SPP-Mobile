import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ✅ Firebase (LOGIC TETAP)
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase"; // ✅ sesuaikan path

// ✅ SAMAKAN DENGAN DASHBOARD
const F = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

function normalizeUser(input: string) {
  const raw = input.trim().toLowerCase();

  // kalau user isi email beneran -> pakai langsung
  if (raw.includes("@")) return raw;

  // kalau user isi username -> jadikan email internal admin cabang
  const uname = raw.replace(/\s+/g, "");
  return `${uname}@cabang.spp`;
}

const LS_REMEMBER = "spp-login-remember-v1"; // simpan on/off
const LS_EMAIL = "spp-login-email-v1"; // simpan user/email (bukan password)

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState(""); // input "User" (bisa email / username)
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPass, setShowPass] = useState(false);

  // ✅ Load preferensi remember + email tersimpan (agar besok tinggal isi password)
  useEffect(() => {
    (async () => {
      try {
        const savedRemember = await AsyncStorage.getItem(LS_REMEMBER);
        const rememberOn = savedRemember == null ? true : savedRemember === "1";
        setRemember(rememberOn);

        if (rememberOn) {
          const savedEmail = (await AsyncStorage.getItem(LS_EMAIL)) || "";
          if (savedEmail) setEmail(savedEmail);
        }
      } catch {
        // abaikan
      }
    })();
  }, []);

  // ✅ Jika user toggle "ingat saya": simpan status, dan kalau OFF hapus email tersimpan
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(LS_REMEMBER, remember ? "1" : "0");
        if (!remember) {
          await AsyncStorage.removeItem(LS_EMAIL);
        } else {
          // kalau baru dinyalakan dan email sudah ada, simpan
          if (email.trim()) await AsyncStorage.setItem(LS_EMAIL, email.trim());
        }
      } catch {
        // abaikan
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember]);

  // ✅ Saat email berubah dan remember ON, simpan email
  useEffect(() => {
    (async () => {
      try {
        if (remember) {
          const v = email.trim();
          if (v) await AsyncStorage.setItem(LS_EMAIL, v);
        }
      } catch {
        // abaikan
      }
    })();
  }, [email, remember]);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0;
  }, [email, password]);

  async function onContinue() {
    const rawInput = email.trim();
    if (!canSubmit) return Alert.alert("Gagal", "User & password wajib diisi.");

    // ✅ username -> email internal
    const loginEmail = normalizeUser(rawInput);

    try {
      // 1) Login ke Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, loginEmail, password);
      const uid = cred.user.uid;

      // 2) Ambil role dari Firestore: users/{uid}
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        await signOut(auth);
        return Alert.alert("Ditolak", "Akun ini belum terdaftar di database.");
      }

      const data = snap.data() as {
        role?: string;
        active?: boolean;
        cabangId?: string;
      };

      // 3) Cek aktif
      if (data.active === false) {
        await signOut(auth);
        return Alert.alert("Ditolak", "Akun nonaktif.");
      }

      // ✅ simpan email yang dipakai untuk login (agar besok tinggal isi password)
      // (password TIDAK disimpan)
      if (remember) {
        await AsyncStorage.setItem(LS_EMAIL, rawInput);
      }

      // 4) Routing berdasarkan role (tanpa ubah logika inti kamu)
      const role = String(data.role || "").toUpperCase();

      if (role === "SUPERADMIN") {
        return router.replace("/superadmin");
      }

      if (role === "ADMIN_CABANG") {
        return router.replace("/admin");
      }

      // role tidak dikenali
      await signOut(auth);
      return Alert.alert("Ditolak", `Role tidak diizinkan: ${role || "-"}`);
    } catch (err: any) {
      const msg = String(err?.message || "Login gagal");

      if (msg.includes("auth/invalid-email")) {
        return Alert.alert(
          "Gagal",
          "Format user salah. Pakai email atau username (tanpa spasi).",
        );
      }

      if (
        msg.includes("auth/invalid-credential") ||
        msg.includes("auth/wrong-password")
      ) {
        return Alert.alert("Gagal", "User/email atau password salah.");
      }
      if (msg.includes("auth/user-not-found")) {
        return Alert.alert("Gagal", "Akun tidak ditemukan.");
      }
      if (msg.includes("auth/network-request-failed")) {
        return Alert.alert("Koneksi", "Cek internet dulu.");
      }

      return Alert.alert("Gagal", msg);
    }
  }

  const { height } = Dimensions.get("window");
  const isSmall = height < 700;

  // ✅ Responsive aman: kasih jarak dari notch/statusbar
  const topSafe = Math.max(insets.top, 12);
  const scrollTopPadding = topSafe + 14; // supaya tidak mepet ke atas di HP

  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        barStyle="dark-content"
        translucent
        backgroundColor="transparent"
      />

      {/* BACKGROUND */}
      <LinearGradient
        colors={["#EAF6FF", "#F7FBFF", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ornamen soft */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { minHeight: height, paddingTop: scrollTopPadding },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* TOP ROW */}
          <View style={styles.topRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.backBtn}
              onPress={() =>
                Alert.alert(
                  "Back",
                  "Nanti bisa diarahkan ke halaman sebelumnya.",
                )
              }
            >
              <Ionicons name="chevron-back" size={18} color="#0F172A" />
            </TouchableOpacity>

            <View style={styles.badge}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#0369A1"
              />
              <Text style={styles.badgeText}>Secure Login</Text>
            </View>
          </View>

          <View style={{ height: isSmall ? 16 : 28 }} />

          {/* HEADER */}
          <View style={styles.headerWrap}>
            <View style={styles.logoCircle}>
              <LinearGradient
                colors={["#0EA5E9", "#38BDF8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGrad}
              >
                <Ionicons name="school-outline" size={22} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.hi}>Shining Sun</Text>
            <Text style={styles.desc}>Cerdas • Ceria • Kreatif • Mandiri</Text>
          </View>

          <View style={{ height: isSmall ? 12 : 18 }} />

          {/* CARD */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Login Admin</Text>
                {/* <Text style={styles.cardSub}>
                  Masukkan email superadmin atau username admin cabang.
                </Text> */}
              </View>
              <View style={styles.chip}>
                <Ionicons name="key-outline" size={14} color="#0F172A" />
                <Text style={styles.chipText}>Auth</Text>
              </View>
            </View>

            {/* USER */}
            <Text style={[styles.label, { marginTop: 16 }]}>User</Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name="person-outline"
                size={18}
                color="#64748B"
                style={styles.leftIcon}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="superadmin@spp.com / adminA"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                style={styles.input}
                returnKeyType="next"
              />
              {email.trim().length > 0 ? (
                <TouchableOpacity
                  onPress={() => setEmail("")}
                  activeOpacity={0.8}
                  style={styles.rightIconBtn}
                >
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* PASSWORD */}
            <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color="#64748B"
                style={styles.leftIcon}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPass}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={onContinue}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowPass((v) => !v)}
                style={styles.rightIconBtn}
              >
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* OPTIONS */}
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <Switch
                  value={remember}
                  onValueChange={setRemember}
                  trackColor={{ false: "#CBD5E1", true: "#34D399" }}
                  thumbColor="#FFFFFF"
                />
                <Text style={styles.remember}>Ingat saya</Text>
              </View>

              <View style={styles.hintPill}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color="#0369A1"
                />
                <Text style={styles.hintPillText}>Email / Username</Text>
              </View>
            </View>

            {/* BUTTON */}
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={onContinue}
              disabled={!canSubmit}
              style={[styles.primaryBtn, !canSubmit && { opacity: 0.55 }]}
            >
              <LinearGradient
                colors={["#0EA5E9", "#0284C7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGrad}
              >
                <Text style={styles.primaryText}>Masuk</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {/* <Text style={styles.note}>
              * Jika “Ingat saya” ON, yang disimpan hanya USER (bukan password).
            </Text> */}
          </View>

          <View style={{ height: 16 }} />

          {/* FOOTER MINI */}
          <Text style={styles.footer}>
            © {new Date().getFullYear()} Shining Sun • Sistem SPP
          </Text>

          {/* ✅ aman untuk gesture bar bawah */}
          <View style={{ height: Math.max(insets.bottom, 12) }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  /* Soft Orbs */
  orb1: {
    position: "absolute",
    top: -60,
    left: -40,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: "rgba(14,165,233,0.18)",
  },
  orb2: {
    position: "absolute",
    bottom: -70,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(56,189,248,0.14)",
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(2,132,199,0.10)",
    borderWidth: 1,
    borderColor: "rgba(2,132,199,0.18)",
  },
  badgeText: {
    color: "#0369A1",
    fontWeight: "800",
    fontSize: 12,
  },

  headerWrap: {
    alignItems: "flex-start",
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    padding: 4,
    marginBottom: 12,
  },
  logoGrad: {
    flex: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  hi: {
    fontSize: 30,
    fontFamily: F.extrabold,
    color: "#0F172A",
  },
  desc: {
    color: "#64748B",
    fontFamily: F.semibold,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: F.extrabold,
  },
  cardSub: {
    marginTop: 6,
    color: "#64748B",
    lineHeight: 18,
    fontWeight: "600",
    maxWidth: 260,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.04)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
  },
  chipText: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 12,
  },

  label: {
    fontFamily: F.bold,
  },
  inputWrap: {
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingLeft: 42,
    paddingRight: 44,
    paddingVertical: Platform.OS === "ios" ? 12 : 0,
    height: 50,
    justifyContent: "center",
  },
  leftIcon: {
    position: "absolute",
    left: 14,
  },
  input: {
    fontSize: 14,
    color: "#0F172A",
    fontFamily: F.bold,
  },
  rightIconBtn: {
    position: "absolute",
    right: 10,
    height: 50,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  rowBetween: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  remember: {
    color: "#0F172A",
    fontFamily: F.semibold,
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(2,132,199,0.08)",
    borderWidth: 1,
    borderColor: "rgba(2,132,199,0.16)",
  },
  hintPillText: {
    color: "#0369A1",
    fontWeight: "900",
    fontSize: 12,
  },

  primaryBtn: {
    marginTop: 16,
    borderRadius: 18,
    overflow: "hidden",
  },
  primaryGrad: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryText: {
    color: "white",
    fontFamily: F.extrabold,
  },
  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontFamily: F.semibold,
    fontSize: 12,
    lineHeight: 16,
  },

  footer: {
    textAlign: "center",
    color: "rgba(100,116,139,0.9)",
    fontFamily: F.semibold,
    fontSize: 12,
  },
});
