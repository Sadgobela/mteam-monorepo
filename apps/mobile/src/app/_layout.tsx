import { useEffect } from "react";
import { Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { apiUrl } from "@/lib/config";
import { routeForPath } from "@/lib/format";
import { LocaleProvider, useLocale } from "@/lib/i18n";
import { showWhileOpen } from "@/lib/push";
import { SessionProvider } from "@/lib/session";
import { useColors } from "@/lib/theme";

showWhileOpen();

/** Opens what a tapped notification is about: an app screen when there is one, else the site's page. */
export function openNotification(response: Notifications.NotificationResponse): void {
  const url = response.notification.request.content.data?.url;
  if (typeof url !== "string") return;
  const route = routeForPath(url);
  if ("screen" in route) router.push(route.screen as never);
  else void Linking.openURL(apiUrl() + route.web);
}

function Screens() {
  const c = useColors();
  const { t } = useLocale();
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    return () => subscription.remove();
  }, []);
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.brandDeep, headerTitleStyle: { color: c.fg }, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "MTeam" }} />
        <Stack.Screen name="listings/[id]" options={{ title: "" }} />
        <Stack.Screen name="login" options={{ title: t.login.title, presentation: "modal" }} />
        <Stack.Screen name="onboarding" options={{ title: t.profile.finish }} />
        <Stack.Screen name="my-listings" options={{ title: t.my.heading }} />
      </Stack>
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
