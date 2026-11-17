import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ListingCard } from "@/components/ListingCard";
import { toSignIn } from "@/components/SignInPrompt";
import { ScreenState } from "@/components/ui";
import { api, type MyListing } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { radius, space, useColors } from "@/lib/theme";

/** Everything the user posted, each with its status: a draft, in review, live, taken down or rejected. */
export default function MyListingsScreen() {
  const c = useColors();
  const { t } = useLocale();
  const [listings, setListings] = useState<MyListing[]>([]);
  const [gelPerUsd, setGelPerUsd] = useState(0);
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const page = await api.myListings();
      setListings(page.listings);
      setGelPerUsd(page.gelPerUsd);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={state === "ready" ? listings : []}
      keyExtractor={(listing) => String(listing.id)}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={[styles.status, { color: c.brandDeep, backgroundColor: c.brandSoft }]}>{t.my.status[item.status]}</Text>
          <ListingCard listing={item} gelPerUsd={gelPerUsd} onSignIn={toSignIn} />
        </View>
      )}
      ListEmptyComponent={state === "ready" ? <ScreenState state="empty" empty={t.my.empty} /> : <ScreenState state={state === "loading" ? "loading" : "failed"} onRetry={load} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.lg },
  item: { gap: space.sm },
  status: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: "hidden" },
});
