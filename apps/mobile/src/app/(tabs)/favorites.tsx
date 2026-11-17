import { useCallback, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import type { PublicListing } from "@mteam/shared";
import { ListingCard } from "@/components/ListingCard";
import { SignInPrompt, toSignIn } from "@/components/SignInPrompt";
import { useBarSpace } from "@/components/TabBar";
import { ScreenState } from "@/components/ui";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";

/** The user's saved listings, loaded again each time the tab opens, so hearts set elsewhere show up. */
export default function FavoritesScreen() {
  const { t } = useLocale();
  const session = useSession();
  const barSpace = useBarSpace();
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [gelPerUsd, setGelPerUsd] = useState(0);
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const signedIn = session.user !== null;

  const load = useCallback(async () => {
    if (!signedIn) return;
    setState("loading");
    try {
      const page = await api.favorites();
      setListings(page.listings);
      setGelPerUsd(page.gelPerUsd);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, [signedIn]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!signedIn) return <SignInPrompt />;
  return (
    <FlatList
      contentContainerStyle={[styles.list, { paddingBottom: barSpace }]}
      data={state === "ready" ? listings : []}
      keyExtractor={(listing) => String(listing.id)}
      renderItem={({ item }) => <ListingCard listing={item} gelPerUsd={gelPerUsd} onSignIn={toSignIn} />}
      ListEmptyComponent={state === "ready" ? <ScreenState state="empty" empty={t.favorites.empty} /> : <ScreenState state={state === "loading" ? "loading" : "failed"} onRetry={load} />}
    />
  );
}

const styles = StyleSheet.create({ list: { padding: space.lg, gap: space.lg } });
