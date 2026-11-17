import { useEffect, useState, type ComponentRef, type RefObject } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fill, useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";
import { dimWhenPressed } from "./ui";

type IconName = keyof typeof Ionicons.glyphMap;
type TabName = "search" | "favorites" | "post" | "notifications" | "account";

export const BAR_HEIGHT = 64;
/** The gap between the menu and the bottom of the screen (or the home indicator). */
const BAR_LIFT = 10;
const CENTRE_SIZE = 60;

/** The tabs, left to right; posting is the raised button in the middle. */
const TABS: { name: TabName; href: string; icon: IconName; iconOn: IconName }[] = [
  { name: "search", href: "/", icon: "search-outline", iconOn: "search" },
  { name: "favorites", href: "/favorites", icon: "heart-outline", iconOn: "heart" },
  { name: "post", href: "/post", icon: "add", iconOn: "add" },
  { name: "notifications", href: "/notifications", icon: "notifications-outline", iconOn: "notifications" },
  { name: "account", href: "/account", icon: "person-outline", iconOn: "person" },
];

/** Screens without the menu: sign-in and the first-visit questions, which have their own way out. */
const WITHOUT_MENU = new Set(["/login", "/onboarding"]);

/** Room a scrolling screen leaves at its end, so its last row can scroll clear of the floating menu. */
export function useBarSpace(): number {
  return useSafeAreaInsets().bottom + BAR_LIFT + BAR_HEIGHT + space.lg;
}

/** Opens a tab from anywhere: screens opened on top of the tabs (a listing) close first. */
export function openTab(href: string): void {
  void Haptics.selectionAsync();
  if (router.canDismiss()) router.dismissAll();
  router.navigate(href as never);
}

/**
 * The app's menu: a frosted-glass bar floating over every screen, with posting raised in the middle and the unread
 * count on notifications. It steps aside while the keyboard is open. On Android the blur reads the screens behind it
 * from `blurTarget`.
 */
export function TabBar({ blurTarget }: { blurTarget?: RefObject<ComponentRef<typeof View> | null> }) {
  const c = useColors();
  const dark = useColorScheme() === "dark";
  const { t } = useLocale();
  const { unread } = useSession();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setTyping(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setTyping(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  if (typing || WITHOUT_MENU.has(path)) return null;
  return (
    <View accessibilityRole="tablist" accessibilityLabel={t.mobile.tabsLabel} pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + BAR_LIFT }]}>
      <View style={[styles.glass, { borderColor: c.glassLine }, Platform.select({ ios: styles.shadow })]}>
        <BlurView
          intensity={70}
          tint={dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glass }]} />
      </View>
      {TABS.map((tab) => {
        const on = path === tab.href;
        const label = t.mobile.tabs[tab.name];
        if (tab.name === "post") {
          return (
            <View key={tab.name} style={styles.slot}>
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                onPress={() => openTab(tab.href)}
                style={dimWhenPressed([styles.centre, { backgroundColor: c.action, borderColor: c.bg }])}
              >
                <Ionicons name={tab.icon} size={32} color={c.onAction} />
              </Pressable>
            </View>
          );
        }
        const badge = tab.name === "notifications" && unread > 0;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={badge ? fill(t.notifications.bellUnread, { count: unread }) : label}
            accessibilityState={{ selected: on }}
            onPress={() => openTab(tab.href)}
            style={dimWhenPressed(styles.slot)}
          >
            <View>
              <Ionicons name={on ? tab.iconOn : tab.icon} size={24} color={on ? c.brand : c.muted} />
              {badge && (
                <View style={[styles.badge, { backgroundColor: c.danger, borderColor: c.surface }]}>
                  <Text style={styles.badgeText}>{unread > 9 ? "9+" : String(unread)}</Text>
                </View>
              )}
            </View>
            <Text numberOfLines={1} style={[styles.label, { color: on ? c.brand : c.muted }, on && styles.labelOn]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space.lg, right: space.lg, height: BAR_HEIGHT, flexDirection: "row", alignItems: "center" },
  glass: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: BAR_HEIGHT / 2, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  shadow: { shadowColor: "#1f1828", shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  slot: { flex: 1, height: BAR_HEIGHT, alignItems: "center", justifyContent: "center", gap: 2 },
  centre: {
    width: CENTRE_SIZE,
    height: CENTRE_SIZE,
    borderRadius: CENTRE_SIZE / 2,
    borderWidth: 4,
    marginTop: -28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6e45a0",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: { fontSize: 10, maxWidth: "100%" },
  labelOn: { fontWeight: "600" },
  badge: { position: "absolute", top: -4, right: -10, minWidth: 18, height: 18, borderRadius: radius.pill, borderWidth: 2, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
});
