import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { formatDay } from "@mteam/shared";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useBarSpace } from "@/components/TabBar";
import { dimWhenPressed, ScreenState } from "@/components/ui";
import { api, type Conversation } from "@/lib/api";
import { initials } from "@/lib/format";
import { fill, useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";

/** The user's chats with sellers and buyers, the latest first, as on the site's messages page. */
export default function MessagesScreen() {
  const c = useColors();
  const { locale, t } = useLocale();
  const session = useSession();
  const barSpace = useBarSpace();
  const [chats, setChats] = useState<Conversation[]>([]);
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const signedIn = session.user !== null;

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      setChats((await api.conversations()).conversations);
      setState("ready");
    } catch {
      setState((current) => (current === "ready" ? current : "failed"));
    }
  }, [signedIn]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!signedIn) return <SignInPrompt />;
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
      testID="chats"
      contentContainerStyle={[styles.list, { paddingBottom: barSpace }]}
      data={state === "ready" ? chats : []}
      keyExtractor={(chat) => chat.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.brand} colors={[c.brand]} />}
      renderItem={({ item }) => {
        const name = item.otherName ?? t.chat.someone;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.unread ? `${t.chat.unread}: ` : ""}${fill(t.mobile.messageTo, { name })}. ${item.listingTitle}`}
            onPress={() => router.push(`/messages/${item.id}`)}
            style={dimWhenPressed([styles.row, { backgroundColor: c.surface, borderColor: c.line }])}
          >
            <View style={[styles.avatar, { backgroundColor: c.brandSoft }]}>
              <Text style={[styles.initial, { color: c.brandDeep }]}>{initials(name)}</Text>
            </View>
            <View style={styles.text}>
              <View style={styles.top}>
                <Text numberOfLines={1} style={[styles.name, { color: c.fg }, item.unread && styles.bold]}>
                  {name}
                </Text>
                <Text style={[styles.day, { color: c.muted }]}>{formatDay(item.lastAt, locale)}</Text>
              </View>
              <Text numberOfLines={1} style={[styles.listing, { color: c.brandDeep }]}>
                {item.listingTitle}
              </Text>
              <Text numberOfLines={1} style={{ color: item.unread ? c.fg : c.muted }}>
                {item.lastBody}
              </Text>
            </View>
            {item.unread && <View testID="unread-dot" style={[styles.dot, { backgroundColor: c.brand }]} />}
          </Pressable>
        );
      }}
      ListEmptyComponent={state === "ready" ? <ScreenState state="empty" empty={t.chat.empty} /> : <ScreenState state={state} onRetry={retry} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 18, fontWeight: "700" },
  text: { flex: 1, gap: 2 },
  top: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  name: { flex: 1, fontSize: 15 },
  bold: { fontWeight: "700" },
  day: { fontSize: 12 },
  listing: { fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
