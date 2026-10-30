import type { ExpoConfig } from "expo/config";
import brand from "./brand.json";

const config: ExpoConfig = {
  name: brand.APP_NAME,
  slug: "planner-app",
  scheme: brand.APP_SCHEME,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: "#10141A",
  ios: {
    supportsTablet: true,
    bundleIdentifier: brand.BUNDLE_ID,
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    package: brand.BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: "#10141A",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    permissions: ["POST_NOTIFICATIONS", "RECEIVE_BOOT_COMPLETED", "VIBRATE"],
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
    output: "single",
    backgroundColor: "#10141A",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-secure-store",
    "expo-sharing",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#10141A",
        image: "./assets/splash-icon.png",
        imageWidth: 180,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#E4B56A",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "00000000-0000-0000-0000-000000000000",
    },
  },
};

export default config;
