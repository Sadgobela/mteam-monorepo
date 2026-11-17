import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { SignInPrompt } from "@/components/SignInPrompt";
import { openTab, useBarSpace } from "@/components/TabBar";
import { dimWhenPressed, ScreenState } from "@/components/ui";
import { api, type SavedSearch } from "@/lib/api";
import { fill, useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";

/**
 * The user's saved searches, as on the site's page: each with its name, how many more filters it has and how many
 * listings are new; opening one shows its results on the search tab, and one can be removed.
 */
export default function SavedSearchesScreen() {
  const c = useColors();
  const { locale, t } = useLocale();
  const session = useSession();
  const barSpace = useBarSpace();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const signedIn = session.user !== null;

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      setSearches((await api.savedSearches(locale)).searches);
      setState("ready");
    } catch {
      setState((current) => (current === "ready" ? current : "failed"));
    }
  }, [signedIn, locale]);

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
  const open = async (search: SavedSearch) => {
    // Opening counts its listings as seen; the search still opens when that cannot be saved.
    const query = await api.openSavedSearch(search.id).then(
      (opened) => opened.query,
      () => search.query,
    );
    setSearches((current) => current.map((other) => (other.id === search.id ? { ...other, newCount: 0 } : other)));
    openTab(`/?${query}`);
  };
  const remove = (search: SavedSearch) => {
    setSearches((current) => current.filter((other) => other.id !== search.id));
    // Should the server not take it, the list comes back as it is there.
    void api.deleteSavedSearch(search.id).catch(load);
  };

  return (
    <FlatList
      testID="saved"
      contentContainerStyle={[styles.list, { paddingBottom: barSpace }]}
      data={state === "ready" ? searches : []}
      keyExtractor={(search) => search.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.brand} colors={[c.brand]} />}
      renderItem={({ item }) => {
        const name = item.others > 0 ? `${item.name} +${item.others}` : item.name;
        return (
          <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${t.saved.open}: ${name}`} onPress={() => void open(item)} style={dimWhenPressed(styles.main)}>
              <View style={[styles.icon, { backgroundColor: c.brandSoft }]}>
                <Ionicons name="bookmark" size={18} color={c.brandDeep} />
              </View>
              <View style={styles.text}>
                <Text numberOfLines={2} style={[styles.name, { color: c.fg }]}>
                  {name}
                </Text>
                {item.newCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: c.brand }]}>
                    <Text style={styles.badgeText}>{fill(t.saved.newCount, { count: item.newCount })}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${t.saved.remove}: ${name}`} hitSlop={8} onPress={() => remove(item)} style={dimWhenPressed(styles.remove)}>
              <Ionicons name="trash-outline" size={20} color={c.danger} />
            </Pressable>
          </View>
        );
      }}
      ListEmptyComponent={state === "ready" ? <ScreenState state="empty" empty={t.saved.empty} /> : <ScreenState state={state} onRetry={retry} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, borderWidth: 1 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: space.xs, alignItems: "flex-start" },
  name: { fontSize: 15, fontWeight: "600" },
  badge: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  badgeText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  remove: { padding: space.md },
});
