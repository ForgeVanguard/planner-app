import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Fraunces_600SemiBold, Fraunces_700Bold } from "@expo-google-fonts/fraunces";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from "@expo-google-fonts/outfit";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BootScreen } from "../src/components/ui";
import { StoreProvider, useApp } from "../src/state/store";
import { colors } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <RootGate fontsLoaded={fontsLoaded || Boolean(fontError)} />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function RootGate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready } = useApp();
  useEffect(() => {
    if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, ready]);
  if (!fontsLoaded || !ready) return <BootScreen />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
