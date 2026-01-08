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

export default function AdminHome() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppHeader
        title="Admin Cabang"
        subtitle="Pilih siswa, input pembayaran, spin jika sebelum tanggal 11."
        chip="Cabang"
      />

      <View style={styles.wrap}>
        <Card style={{ gap: 10 }}>
          <H1>Menu Utama</H1>
          <P>Kelola pembayaran SPP siswa untuk cabang ini.</P>

          <PrimaryButton
            title="Bayar SPP"
            onPress={() => router.push("/admin/bayar")}
            color={theme.green}
          />
          <PrimaryButton
            title="Riwayat Pembayaran"
            onPress={() => router.push("/admin/riwayat")}
            color={theme.sky}
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
