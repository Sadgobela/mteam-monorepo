import { Tabs } from "expo-router";
import { Wordmark } from "@/components/Brand";
import { useLocale } from "@/lib/i18n";
import { useColors } from "@/lib/theme";

/** The tabs themselves; their menu is the floating glass bar the root layout draws over every screen. */
export default function TabsLayout() {
  const c = useColors();
  const { t } = useLocale();
  return (
    <Tabs
      tabBar={() => null}
      backBehavior="history"
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTitleStyle: { color: c.fg },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.mobile.tabs.search, headerTitle: () => <Wordmark width={96} color={c.logo} /> }} />
      <Tabs.Screen name="favorites" options={{ title: t.mobile.tabs.favorites }} />
      <Tabs.Screen name="post" options={{ title: t.mobile.tabs.post, headerTitle: t.post.heading }} />
      <Tabs.Screen name="notifications" options={{ title: t.notifications.heading }} />
      <Tabs.Screen name="account" options={{ title: t.mobile.tabs.account }} />
    </Tabs>
  );
}
