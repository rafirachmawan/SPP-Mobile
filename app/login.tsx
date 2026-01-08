import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import AppHeader from "../components/AppHeader";
import { Card, PrimaryButton, P } from "../components/ui-kit";
import { theme } from "../components/theme";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const hint = useMemo(
    () => `Coba: "admin" atau "superadmin" (password bebas dulu).`,
    []
  );

  function onLogin() {
    const u = username.trim().toLowerCase();
    if (!u || !password)
      return Alert.alert("Gagal", "Username & password wajib diisi.");

    if (u === "admin") return router.replace("./admin");
    if (u === "superadmin") return router.replace("./superadmin");

    Alert.alert("Akun tidak dikenal", hint);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader
            title="Login"
            subtitle="Masuk sebagai Admin Cabang atau Super Admin. (Database menyusul)"
            chip="UI Mode"
          />

          <View style={styles.container}>
            <Card style={{ gap: 10 }}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                placeholder="contoh: admin / superadmin"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                style={styles.input}
              />

              <Text style={[styles.label, { marginTop: 6 }]}>Password</Text>
              <TextInput
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
              />

              <PrimaryButton
                title="Login"
                onPress={onLogin}
                color={theme.primary}
              />

              <P style={{ marginTop: 6 }}>{hint}</P>
            </Card>

            <Text style={styles.footer}>
              © {new Date().getFullYear()} SPP Mobile — UI Prototype
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  label: {
    color: theme.text,
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  footer: {
    marginTop: 14,
    textAlign: "center",
    color: theme.sub,
    fontSize: 12,
  },
});
