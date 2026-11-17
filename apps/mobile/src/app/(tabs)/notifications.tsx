import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { formatDay } from "@mteam/shared";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useBarSpace } from "@/components/TabBar";
import { Button, dimWhenPressed, ScreenState } from "@/components/ui";
import { api, type Notice } from "@/lib/api";
import { followPath } from "@/lib/follow";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";

/**
 * The user's notifications, as on the site's notifications page: newest first, the unread ones marked. Opening one
 * marks it read and goes where it leads. Loaded again each time the tab opens, and on a pull.
 */
export default function NotificationsScreen() {
  const c = useColors();
  const { locale, t } = useLocale();
  const session = useSession();
  const barSpace = useBarSpace();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const signedIn = session.user !== null;
  const { setUnread } = session;

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      const page = await api.notifications(locale);
      setNotices(page.notifications);
      setUnread(page.unread);
      setState("ready");
    } catch {
      // A failed refresh keeps the list it has.
      setState((current) => (current === "ready" ? current : "failed"));
    }
  }, [signedIn, locale, setUnread]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!signedIn) return <SignInPrompt />;

  const unread = notices.filter((notice) => !notice.read).length;
  const markRead = (id?: string) => setNotices((current) => current.map((notice) => (id === undefined || notice.id === id ? { ...notice, read: true } : notice)));
  const open = async (notice: Notice) => {
    markRead(notice.id);
    // From the server's count, not this list, which holds only the newest 50.
    if (!notice.read) setUnread((count) => Math.max(0, count - 1));
    try {
      followPath((await api.openNotification(notice.id, locale)).path);
    } catch {
      // Offline: it stays read here and is marked on the server the next time.
    }
  };
  const readAll = async () => {
    markRead();
    setUnread(0);
    await api.readAllNotifications().catch(() => undefined);
  };
  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  const retry = () => {
    setState("loading");
    void load();
  };

  return (
    <FlatList
      testID="notifications"
      contentContainerStyle={[styles.list, { paddingBottom: barSpace }]}
      data={state === "ready" ? notices : []}
      keyExtractor={(notice) => notice.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.brand} colors={[c.brand]} />}
      ListHeaderComponent={unread > 0 ? <Button quiet label={t.notifications.markAllRead} onPress={() => void readAll()} /> : undefined}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.read ? "" : `${t.notifications.unread}: `}${item.title}. ${item.body}`}
          onPress={() => void open(item)}
          style={dimWhenPressed([styles.row, { backgroundColor: item.read ? c.surface : c.brandSoft, borderColor: c.line }])}
        >
          <View style={[styles.icon, { backgroundColor: item.read ? c.brandSoft : c.surface }]}>
            <Ionicons name="notifications-outline" size={20} color={c.brandDeep} />
          </View>
          <View style={styles.text}>
            <Text numberOfLines={1} style={[styles.title, { color: c.fg }, !item.read && styles.bold]}>
              {item.title}
            </Text>
            <Text style={{ color: c.fg }}>{item.body}</Text>
            <Text style={[styles.day, { color: c.muted }]}>{formatDay(item.at, locale)}</Text>
          </View>
          {!item.read && <View testID="unread-dot" style={[styles.dot, { backgroundColor: c.brand }]} />}
        </Pressable>
      )}
      ListEmptyComponent={state === "ready" ? <ScreenState state="empty" empty={t.notifications.empty} /> : <ScreenState state={state} onRetry={retry} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15 },
  bold: { fontWeight: "700" },
  day: { fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
