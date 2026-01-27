import * as Updates from "expo-updates";
import { Alert } from "react-native";

export async function checkAndUpdateApp(force = false) {
  try {
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();

      Alert.alert("Update tersedia", "Aplikasi akan diperbarui sekarang", [
        {
          text: "OK",
          onPress: () => Updates.reloadAsync(),
        },
      ]);
    } else if (force) {
      Alert.alert("Info", "Aplikasi sudah versi terbaru");
    }
  } catch (e) {
    Alert.alert("Gagal update", "Coba lagi nanti");
  }
}
