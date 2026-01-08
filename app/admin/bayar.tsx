import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import AppHeader from "../../components/AppHeader";
import {
  Badge,
  Card,
  H1,
  P,
  PrimaryButton,
  GhostButton,
} from "../../components/ui-kit";
import { theme } from "../../components/theme";

export default function BayarSPP() {
  // ✅ dummy siswa (nanti dari Firebase)
  const students = useMemo(
    () => [
      { id: "S1", name: "ANAK A", tipe: "Normal", nominal: 200000 },
      { id: "S2", name: "ANAK B", tipe: "Beasiswa 0", nominal: 0 },
      { id: "S3", name: "ANAK C", tipe: "Pertemuan (8x)", nominal: 150000 },
      { id: "S4", name: "ANAK D", tipe: "Beasiswa 100", nominal: 100000 },
    ],
    []
  );

  const [query, setQuery] = useState("");
  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const selected = filtered[0]; // biar simple (nanti kita buat picker proper)

  // contoh rule spin: jika < 11
  const today = new Date();
  const canSpin = today.getDate() < 11;

  function onPay() {
    if (!selected) return Alert.alert("Info", "Siswa tidak ditemukan.");
    Alert.alert(
      "Sukses (dummy)",
      `Pembayaran untuk ${selected.name} tersimpan (nanti Firebase).`
    );
  }

  function onSpin() {
    if (!canSpin)
      return Alert.alert("Tidak bisa spin", "Spin hanya sebelum tanggal 11.");
    Alert.alert(
      "Hasil Spin (dummy)",
      "Selamat! Anda dapat potongan Rp 10.000 bulan depan."
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppHeader
        title="Bayar SPP"
        subtitle="Cari siswa lalu proses pembayaran. Spin tersedia sebelum tanggal 11."
        chip={canSpin ? "Spin ON" : "Spin OFF"}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 20,
          gap: 12,
        }}
      >
        <Card style={{ gap: 10 }}>
          <H1>Cari Siswa</H1>
          <TextInput
            placeholder="Ketik nama siswa..."
            value={query}
            onChangeText={setQuery}
            style={styles.input}
          />
          <P>
            Tip: ketik nama, hasil teratas jadi pilihan sementara (UI
            prototype).
          </P>
        </Card>

        <Card style={{ gap: 10 }}>
          <H1>Detail</H1>

          {selected ? (
            <>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{selected.name}</Text>
                <Badge
                  label={selected.tipe}
                  tone={
                    selected.tipe.includes("Beasiswa")
                      ? "info"
                      : selected.tipe.includes("Pertemuan")
                      ? "warning"
                      : "success"
                  }
                />
              </View>

              <View style={styles.hr} />

              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Nominal</Text>
                <Text style={styles.money}>
                  Rp {selected.nominal.toLocaleString("id-ID")}
                </Text>
              </View>

              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Tanggal</Text>
                <Text style={styles.meta2}>
                  {today.getDate()}-{today.getMonth() + 1}-{today.getFullYear()}
                </Text>
              </View>

              <PrimaryButton
                title="Bayar Sekarang"
                onPress={onPay}
                color={theme.amber}
              />

              <PrimaryButton
                title={`Spin (Jika ${"<"} Tanggal 11)`}
                onPress={onSpin}
                color={theme.violet}
                disabled={!canSpin}
              />
            </>
          ) : (
            <P>Siswa tidak ditemukan. Coba ketik nama lain.</P>
          )}
        </Card>

        <GhostButton
          title="Kembali"
          onPress={() => Alert.alert("Info", "Gunakan tombol back HP ya.")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontWeight: "900",
    fontSize: 16,
    color: theme.text,
  },
  hr: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 6,
  },
  meta: {
    color: theme.sub,
    fontWeight: "700",
  },
  meta2: {
    color: theme.text,
    fontWeight: "800",
  },
  money: {
    color: theme.text,
    fontWeight: "900",
    fontSize: 16,
  },
});
