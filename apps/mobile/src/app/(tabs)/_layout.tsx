import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Tabs } from "expo-router";
import { Wordmark } from "@/components/Brand";
import { dimWhenPressed } from "@/components/ui";
import { useLocale } from "@/lib/i18n";
import { space, useColors } from "@/lib/theme";

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
      <Tabs.Screen
        name="index"
        options={{
          title: t.mobile.tabs.search,
          headerTitle: () => <Wordmark width={96} color={c.logo} />,
          // Chats are a tap away from the first screen, as the site's header links to them.
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel={t.mobile.messages} hitSlop={8} onPress={() => router.push("/messages")} style={dimWhenPressed(styles.icon)}>
              <Ionicons name="chatbubbles-outline" size={24} color={c.brandDeep} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="favorites" options={{ title: t.mobile.tabs.favorites }} />
      <Tabs.Screen name="post" options={{ title: t.mobile.tabs.post, headerTitle: t.post.heading }} />
      <Tabs.Screen name="notifications" options={{ title: t.notifications.heading }} />
      <Tabs.Screen name="account" options={{ title: t.mobile.tabs.account }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({ icon: { paddingHorizontal: space.lg } });
