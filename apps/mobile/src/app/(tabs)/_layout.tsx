import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useLocale } from "@/lib/i18n";
import { useColors, type Palette } from "@/lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;
/** A tab's icon in the brand colour when its tab is open. */
export const tabIcon = (name: IconName, c: Palette) =>
  function TabIcon({ focused, size }: { focused: boolean; size: number }) {
    return <Ionicons name={name} color={focused ? c.brand : c.muted} size={size} />;
  };

export default function TabsLayout() {
  const c = useColors();
  const { t } = useLocale();
  const icon = (name: IconName) => tabIcon(name, c);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        headerStyle: { backgroundColor: c.surface },
        headerTitleStyle: { color: c.fg },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.mobile.tabs.search, headerTitle: "MTeam", tabBarIcon: icon("search") }} />
      <Tabs.Screen name="favorites" options={{ title: t.mobile.tabs.favorites, tabBarIcon: icon("heart-outline") }} />
      <Tabs.Screen name="post" options={{ title: t.mobile.tabs.post, headerTitle: t.post.heading, tabBarIcon: icon("add-circle-outline") }} />
      <Tabs.Screen name="account" options={{ title: t.mobile.tabs.account, tabBarIcon: icon("person-outline") }} />
    </Tabs>
  );
}
