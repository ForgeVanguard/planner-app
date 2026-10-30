import { Platform } from "react-native";
import { APP_NAME } from "../config";
import type { Profile } from "../types";

function parts(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 7,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  };
}

export async function syncReminders(profile: Profile | null): Promise<void> {
  if (Platform.OS === "web" || !profile) return;
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted) {
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted) return;
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("daily", {
        name: "Daily reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!profile.remindersEnabled) return;
    const morning = parts(profile.morningReminder);
    const evening = parts(profile.eveningReminder);
    await Notifications.scheduleNotificationAsync({
      content: { title: APP_NAME, body: "Your tactics for today are on the table." },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: morning.hour, minute: morning.minute, channelId: "daily" },
    });
    await Notifications.scheduleNotificationAsync({
      content: { title: APP_NAME, body: "Log the After Action Review before the day disappears." },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: evening.hour, minute: evening.minute, channelId: "daily" },
    });
  } catch {
    // Notifications are unavailable in Expo web and in some simulators. The rest of the app still runs.
  }
}
