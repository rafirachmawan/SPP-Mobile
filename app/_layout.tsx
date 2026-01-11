// FILE: app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { ThemeProvider, DefaultTheme } from "@react-navigation/native";

import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!loaded) return null;

  // ✅ Theme global untuk React Navigation (expo-router pakai ini)
  const theme = {
    ...DefaultTheme,
    fonts: {
      regular: { fontFamily: "Inter_400Regular", fontWeight: "400" as any },
      medium: { fontFamily: "Inter_600SemiBold", fontWeight: "600" as any },
      bold: { fontFamily: "Inter_700Bold", fontWeight: "700" as any },
      heavy: { fontFamily: "Inter_800ExtraBold", fontWeight: "800" as any },
    },
  };

  return (
    <ThemeProvider value={theme}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      />
    </ThemeProvider>
  );
}
