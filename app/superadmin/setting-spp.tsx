import { useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import AppHeader from "../../components/AppHeader";
import { Card, H1, P, PrimaryButton, Badge } from "../../components/ui-kit";
import { theme } from "../../components/theme";

export default function SettingSPP() {
  const [sppNormal, setSppNormal] = useState("200000");
  const [beaFlat, setBeaFlat] = useState("100000");
  const [beaGratis, setBeaGratis] = useState("0");
  const [jamBea, setJamBea] = useState("13:00 / 14:00");
  const [tipePertemuan, setTipePertemuan] = useState("8x, 12x, 16x (contoh)");

  function onSave() {
    Alert.alert(
      "Tersimpan (dummy)",
      "Nanti data ini akan disimpan ke Firebase."
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppHeader
        title="Setting SPP"
        subtitle="Atur nominal normal, beasiswa, dan tipe pertemuan."
        chip="Config"
      />

      <ScrollView contentContainerStyle={styles.wrap}>
        <Card style={{ gap: 8 }}>
          <H1>SPP Normal</H1>
          <P>
            Nominal default untuk siswa normal (bisa juga per cabang nanti).
          </P>
          <TextInput
            value={sppNormal}
            onChangeText={setSppNormal}
            keyboardType="numeric"
            style={styles.input}
          />
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={styles.rowBetween}>
            <H1>Beasiswa</H1>
            <Badge label="2 Tipe" tone="info" />
          </View>
          <P>
            Beasiswa terdiri dari nominal flat dan gratis (0). Jam khusus: jam
            1/2 siang.
          </P>

          <Text style={styles.label}>Nominal Beasiswa Flat</Text>
          <TextInput
            value={beaFlat}
            onChangeText={setBeaFlat}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Nominal Beasiswa 0</Text>
          <TextInput
            value={beaGratis}
            onChangeText={setBeaGratis}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Jam Beasiswa</Text>
          <TextInput
            value={jamBea}
            onChangeText={setJamBea}
            style={styles.input}
          />
        </Card>

        <Card style={{ gap: 8 }}>
          <H1>Tipe Pertemuan</H1>
          <P>Contoh: paket 8x/12x/16x pertemuan, nominal berbeda.</P>
          <TextInput
            value={tipePertemuan}
            onChangeText={setTipePertemuan}
            style={styles.input}
          />
        </Card>

        <PrimaryButton title="Simpan" onPress={onSave} color={theme.primary} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  label: {
    fontWeight: "800",
    color: theme.text,
    marginTop: 6,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
