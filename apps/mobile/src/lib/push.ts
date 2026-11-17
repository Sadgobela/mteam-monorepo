import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { api } from "./api";
import { easProjectId } from "./config";
import { readStored, writeStored } from "./storage";

const KEY = "pushToken";

export type PushResult = "on" | "blocked" | "unavailable";

/** Shows a notification that arrives while the app is open, as one that arrives while it is closed. */
export function showWhileOpen(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Asks for permission if needed, then gives the server this phone's Expo push token. */
export async function turnOnPush(locale: string): Promise<PushResult> {
  const projectId = easProjectId();
  if (!Device.isDevice || !projectId) return "unavailable";
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "MTeam", importance: AndroidImportance.DEFAULT });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return "blocked";
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.savePush(token, Platform.OS === "ios" ? "ios" : "android", locale);
  await writeStored(KEY, token);
  return "on";
}

/** Stops push to this phone, before signing out or when switched off. Failing to reach the server is not an error. */
export async function turnOffPush(): Promise<void> {
  const token = await readStored(KEY);
  if (!token) return;
  await api.deletePush(token).catch(() => undefined);
  await writeStored(KEY, null);
}

/** Whether push was turned on for this phone, as far as the app remembers. */
export async function pushIsOn(): Promise<boolean> {
  return (await readStored(KEY)) !== null;
}
