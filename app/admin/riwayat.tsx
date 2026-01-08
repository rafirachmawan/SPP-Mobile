import { View, StyleSheet, ScrollView, Text } from "react-native";
import AppHeader from "../../components/AppHeader";
import { Badge, Card, H1, P } from "../../components/ui-kit";
import { theme } from "../../components/theme";

export default function Riwayat() {
  const data = [
    {
      id: "1",
      nama: "ANAK A",
      bulan: "Januari 2026",
      nominal: 200000,
      status: "Lunas",
    },
    {
      id: "2",
      nama: "ANAK B",
      bulan: "Januari 2026",
      nominal: 0,
      status: "Beasiswa",
    },
    {
      id: "3",
      nama: "ANAK C",
      bulan: "Januari 2026",
      nominal: 150000,
      status: "Lunas",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppHeader
        title="Riwayat Pembayaran"
        subtitle="Daftar pembayaran terakhir (dummy)."
        chip="History"
      />

      <ScrollView contentContainerStyle={styles.wrap}>
        <Card style={{ gap: 8 }}>
          <H1>Ringkasan</H1>
          <P>
            Ini masih dummy. Nanti akan realtime dari Firebase + Spreadsheet.
          </P>
        </Card>

        {data.map((x) => (
          <Card key={x.id} style={{ gap: 8 }}>
            <View style={styles.topRow}>
              <Text style={styles.name}>{x.nama}</Text>
              <Badge
                label={x.status}
                tone={x.status === "Lunas" ? "success" : "info"}
              />
            </View>
            <Text style={styles.sub}>{x.bulan}</Text>
            <Text style={styles.money}>
              Rp {x.nominal.toLocaleString("id-ID")}
            </Text>
          </Card>
        ))}
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontWeight: "900",
    color: theme.text,
    fontSize: 16,
  },
  sub: {
    color: theme.sub,
  },
  money: {
    fontWeight: "900",
    color: theme.text,
    fontSize: 16,
  },
});
