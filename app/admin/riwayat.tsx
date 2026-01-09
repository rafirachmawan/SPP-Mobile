import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function AdminRiwayatTab() {
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
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={["#BFE9FF", "#EAF6FF", "#F7FBFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>SPP Mobile</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Cabang</Text>
          </View>
        </View>

        <Text style={styles.title}>Riwayat Pembayaran</Text>
        <Text style={styles.subtitle}>
          Daftar pembayaran terakhir (dummy). Nanti realtime dari database.
        </Text>

        {data.map((x) => (
          <View key={x.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{x.nama}</Text>
              <View
                style={[
                  styles.badge,
                  x.status === "Lunas" ? styles.badgeOk : styles.badgeInfo,
                ]}
              >
                <Text style={styles.badgeText}>{x.status}</Text>
              </View>
            </View>

            <Text style={styles.sub}>{x.bulan}</Text>
            <Text style={styles.money}>
              Rp {x.nominal.toLocaleString("id-ID")}
            </Text>
          </View>
        ))}

        <View style={{ height: 10 }} />
      </ScrollView>
    </View>
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
  brand: {
    fontWeight: "900",
    color: "#1D4ED8",
    letterSpacing: 0.4,
  },
  chip: {
    backgroundColor: "rgba(219,234,254,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,1)",
  },
  chipText: {
    color: "#1E40AF",
    fontWeight: "900",
    fontSize: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },
  subtitle: {
    color: "#64748B",
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 2,
  },

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
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  name: {
    fontWeight: "900",
    color: "#0F172A",
    fontSize: 16,
    flex: 1,
  },
  sub: {
    marginTop: 8,
    color: "#64748B",
    fontWeight: "700",
  },
  money: {
    marginTop: 6,
    fontWeight: "900",
    color: "#0F172A",
    fontSize: 16,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: "900",
    fontSize: 12,
  },
  badgeOk: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
  },
  badgeInfo: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
  },
});
