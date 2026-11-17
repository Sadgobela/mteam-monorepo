import { useEffect, useRef, type ComponentRef } from "react";
import { StyleSheet, type View } from "react-native";
import { BlurTargetView } from "expo-blur";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BootScreen } from "@/components/Brand";
import { TabBar } from "@/components/TabBar";
import { api } from "@/lib/api";
import { followPath } from "@/lib/follow";
import { LocaleProvider, useLocale } from "@/lib/i18n";
import { showWhileOpen } from "@/lib/push";
import { SessionProvider, useSession } from "@/lib/session";
import { useColors } from "@/lib/theme";

showWhileOpen();

/** The last notification opened, so the one that started the app is not opened twice. */
let lastOpened: string | null = null;

/**
 * Opens what a tapped notification is about, as an app screen when there is one, and marks it read on the server (the
 * notification's `tag` is its id). `then` runs once that is saved, to refresh the unread count.
 */
export function openNotification(response: Notifications.NotificationResponse, then?: () => void): void {
  const { identifier, content } = response.notification.request;
  const url = content.data?.url;
  if (typeof url !== "string" || (identifier && identifier === lastOpened)) return;
  lastOpened = identifier ?? null;
  followPath(url);
  const tag = content.data?.tag;
  // The language only shapes the path in the answer, which the tap already carries.
  if (typeof tag === "string") void api.openNotification(tag, "ka").then(then, () => undefined);
}

function Screens() {
  const c = useColors();
  const { t } = useLocale();
  const session = useSession();
  const behind = useRef<ComponentRef<typeof View>>(null);
  const { refresh } = session;

  useEffect(() => {
    const opened = (response: Notifications.NotificationResponse) => openNotification(response, () => void refresh());
    // A tap that started the app came before this listener: open it once the screens are up.
    void Notifications.getLastNotificationResponseAsync().then((response) => response && opened(response));
    const tapped = Notifications.addNotificationResponseReceivedListener(opened);
    // A notification that arrives while the app is open updates the badge on the menu.
    const arrived = Notifications.addNotificationReceivedListener(() => void refresh());
    return () => {
      tapped.remove();
      arrived.remove();
    };
  }, [refresh]);

  return (
    <>
      <StatusBar style="auto" />
      <BlurTargetView ref={behind} style={styles.fill}>
        <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.brandDeep, headerTitleStyle: { color: c.fg }, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "MTeam" }} />
          <Stack.Screen name="listings/[id]" options={{ title: "" }} />
          <Stack.Screen name="login" options={{ title: t.login.title, presentation: "modal" }} />
          <Stack.Screen name="onboarding" options={{ title: t.profile.finish }} />
          <Stack.Screen name="my-listings" options={{ title: t.my.heading }} />
        </Stack>
      </BlurTargetView>
      <TabBar blurTarget={behind} />
      <BootScreen done={session.ready} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <SessionProvider>
          <Screens />
        </SessionProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
