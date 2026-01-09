import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// ✅ Firebase
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase"; // ✅ sesuaikan path

function normalizeUser(input: string) {
  const raw = input.trim().toLowerCase();

  // kalau user isi email beneran -> pakai langsung
  if (raw.includes("@")) return raw;

  // kalau user isi username -> jadikan email internal admin cabang
  const uname = raw.replace(/\s+/g, "");
  return `${uname}@cabang.spp`;
}

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState(""); // ini input "User" (bisa email / username)
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPass, setShowPass] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0;
  }, [email, password]);

  async function onContinue() {
    const rawInput = email.trim();
    if (!canSubmit) return Alert.alert("Gagal", "User & password wajib diisi.");

    // ✅ di sini yang membedakan: username -> email internal
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

      // 4) Routing berdasarkan role (tanpa ubah logika inti kamu)
      const role = String(data.role || "").toUpperCase();

      if (role === "SUPERADMIN") {
        return router.replace("/superadmin");
      }

      if (role === "ADMIN_CABANG") {
        // ✅ masuk admin cabang
        // ganti "/admin" kalau route kamu beda
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
          "Format user salah. Pakai email atau username (tanpa spasi)."
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

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { minHeight: height }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.backBtn}
            onPress={() =>
              Alert.alert("Back", "Nanti bisa diarahkan ke halaman sebelumnya.")
            }
          >
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>

          <View style={{ height: isSmall ? 26 : 54 }} />

          <Text style={styles.hi}>Shining Sun 🌤️</Text>
          <Text style={styles.desc}>Cerdas • Ceria • Kreatif • Mandiri </Text>

          <View style={{ height: isSmall ? 14 : 26 }} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Login Admin</Text>
            <Text style={styles.cardSub}>
              Masukkan email superadmin atau username admin cabang.
            </Text>

            <Text style={[styles.label, { marginTop: 14 }]}>User</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="contoh: superadmin@spp.com / adminA"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                style={styles.input}
              />
              <View style={styles.rightIcon}>
                <Ionicons name="person-outline" size={18} color="#64748B" />
              </View>
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPass}
                style={styles.input}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowPass((v) => !v)}
                style={styles.rightIcon}
              >
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

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
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onContinue}
              disabled={!canSubmit}
              style={[styles.primaryBtn, !canSubmit && { opacity: 0.55 }]}
            >
              <Text style={styles.primaryText}>Masuk</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              * Email untuk SUPERADMIN, username untuk ADMIN CABANG.
            </Text>
          </View>

          <View style={{ height: isSmall ? 14 : 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.85)",
  },

  hi: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 6,
    letterSpacing: 0.2,
  },
  desc: {
    marginTop: 8,
    color: "#64748B",
    lineHeight: 20,
    maxWidth: 320,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  cardSub: {
    marginTop: 6,
    color: "#64748B",
    lineHeight: 18,
    fontWeight: "600",
  },

  label: {
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 8,
  },
  inputWrap: {
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 42,
    paddingVertical: Platform.OS === "ios" ? 12 : 0,
    height: 48,
    justifyContent: "center",
  },
  input: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "700",
  },
  rightIcon: {
    position: "absolute",
    right: 12,
    height: 48,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  rowBetween: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  remember: {
    color: "#0F172A",
    fontWeight: "800",
  },

  primaryBtn: {
    marginTop: 16,
    backgroundColor: "#0EA5E9",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "white",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.2,
  },

  note: {
    marginTop: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 12,
  },
});
