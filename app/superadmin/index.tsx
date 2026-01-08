import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import AppHeader from "../../components/AppHeader";
import {
  Card,
  H1,
  P,
  PrimaryButton,
  GhostButton,
} from "../../components/ui-kit";
import { theme } from "../../components/theme";

export default function SuperAdminHome() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppHeader
        title="Super Admin"
        subtitle="Atur nominal SPP, tipe siswa, dan aturan beasiswa."
        chip="Master"
      />

      <View style={styles.wrap}>
        <Card style={{ gap: 10 }}>
          <H1>Pengaturan</H1>
          <P>Kelola aturan yang dipakai oleh semua admin cabang.</P>

          <PrimaryButton
            title="Setting SPP & Tipe Siswa"
            onPress={() => router.push("/superadmin/setting-spp")}
            color={theme.primary}
          />

          <GhostButton
            title="Logout"
            onPress={() => router.replace("/login")}
            color={theme.red}
          />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
});
