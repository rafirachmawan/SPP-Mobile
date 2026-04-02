import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth } from "../../firebase";

export default function GantiPassword() {
  const router = useRouter();

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 tambahan state untuk toggle mata
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleChangePassword() {
    try {
      if (!oldPass || !newPass || !confirmPass) {
        Alert.alert("Error", "Semua field harus diisi");
        return;
      }

      if (newPass.length < 6) {
        Alert.alert("Error", "Password minimal 6 karakter");
        return;
      }

      if (newPass !== confirmPass) {
        Alert.alert("Error", "Konfirmasi password tidak sama");
        return;
      }

      const user = auth.currentUser;

      if (!user || !user.email) {
        Alert.alert("Error", "User tidak ditemukan");
        return;
      }

      setLoading(true);

      const credential = EmailAuthProvider.credential(user.email, oldPass);

      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPass);

      setLoading(false);

      Alert.alert("Berhasil", "Password berhasil diganti");
      router.back();
    } catch (err: any) {
      setLoading(false);
      console.log(err);

      if (err.code === "auth/wrong-password") {
        Alert.alert("Error", "Password lama salah");
      } else {
        Alert.alert("Error", err.message);
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Ganti Password</Text>
      <View style={styles.form}>
        {/* Password Lama */}
        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={18} />
          <TextInput
            placeholder="Password Lama"
            secureTextEntry={!showOld}
            value={oldPass}
            onChangeText={setOldPass}
            style={styles.input}
          />
          <TouchableOpacity onPress={() => setShowOld(!showOld)}>
            <Ionicons
              name={showOld ? "eye-off-outline" : "eye-outline"}
              size={18}
            />
          </TouchableOpacity>
        </View>

        {/* Password Baru */}
        <View style={styles.inputBox}>
          <Ionicons name="key-outline" size={18} />
          <TextInput
            placeholder="Password Baru"
            secureTextEntry={!showNew}
            value={newPass}
            onChangeText={setNewPass}
            style={styles.input}
          />
          <TouchableOpacity onPress={() => setShowNew(!showNew)}>
            <Ionicons
              name={showNew ? "eye-off-outline" : "eye-outline"}
              size={18}
            />
          </TouchableOpacity>
        </View>

        {/* Konfirmasi Password */}
        <View style={styles.inputBox}>
          <Ionicons name="shield-checkmark-outline" size={18} />
          <TextInput
            placeholder="Konfirmasi Password"
            secureTextEntry={!showConfirm}
            value={confirmPass}
            onChangeText={setConfirmPass}
            style={styles.input}
          />
          <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
            <Ionicons
              name={showConfirm ? "eye-off-outline" : "eye-outline"}
              size={18}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleChangePassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Memproses..." : "Ganti Password"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    padding: 20,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },

  form: {
    gap: 14,
  },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 50,
    gap: 10,
  },

  input: {
    flex: 1,
  },

  button: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
