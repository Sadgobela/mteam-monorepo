import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { listingDescription } from "@mteam/shared";
import { ListingCard } from "@/components/ListingCard";
import { toSignIn } from "@/components/SignInPrompt";
import { Button, Heading, Note, ScreenState } from "@/components/ui";
import { api, type ListingPage } from "@/lib/api";
import { cardTitle, factsLine, priceLine, whatsappLink } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";

/** One listing: photos to swipe through, price and facts, the description, and call or WhatsApp. */
export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { width } = useWindowDimensions();
  const { locale, t } = useLocale();
  const session = useSession();
  const [page, setPage] = useState<ListingPage | null>(null);
  const [state, setState] = useState<"loading" | "failed" | "missing" | "ready">("loading");
  const [phoneBusy, setPhoneBusy] = useState(false);

  const load = useCallback(
    () =>
      api.listing(id).then(
        (next) => {
          setPage(next);
          setState("ready");
        },
        (error: unknown) => setState(error instanceof Error && error.message === "notFound" ? "missing" : "failed"),
      ),
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const retry = () => {
    setState("loading");
    void load();
  };

  if (state !== "ready" || !page) {
    if (state === "missing") return <ScreenState state="empty" empty={t.mobile.listingGone} />;
    return <ScreenState state={state === "loading" ? "loading" : "failed"} onRetry={retry} />;
  }

  const { listing, similar, gelPerUsd } = page;
  const favorite = session.favoriteIds.has(listing.id);
  const contact = async (open: (phone: string) => string) => {
    setPhoneBusy(true);
    try {
      const { phone } = await api.phone(listing.id);
      await Linking.openURL(open(phone));
    } catch {
      Alert.alert(t.listing.phoneFailed);
    } finally {
      setPhoneBusy(false);
    }
  };
  const toggleFavorite = async () => {
    if (!(await session.toggleFavorite(listing.id))) toSignIn();
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: `ID ${listing.id}` }} />
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {listing.images.map((uri, index) => (
          <Image key={uri} source={{ uri }} style={{ width, aspectRatio: 4 / 3 }} contentFit="cover" accessibilityLabel={`${t.card.photo} ${index + 1}`} />
        ))}
      </ScrollView>
      <View style={styles.body}>
        <Text style={[styles.price, { color: c.fg }]}>{priceLine(listing, t, gelPerUsd)}</Text>
        <Heading>{cardTitle(listing, locale, t)}</Heading>
        <Note>{factsLine(listing, t)}</Note>
        {listing.address ? <Note>{listing.address}</Note> : null}
        {listing.verified && <Text style={[styles.badge, { color: c.brandDeep, backgroundColor: c.brandSoft }]}>MTeam Verified</Text>}
        {listing.agent && <Note>{`${listing.agent.name} · ${listing.agent.branch}`}</Note>}
        <View style={styles.actions}>
          {listing.hidePhone ? null : (
            <>
              <Button label={t.listing.call} busy={phoneBusy} onPress={() => void contact((phone) => `tel:${phone}`)} />
              <Button quiet label={t.listing.whatsapp} disabled={phoneBusy} onPress={() => void contact(whatsappLink)} />
            </>
          )}
          <Button quiet label={favorite ? t.favorites.remove : t.favorites.add} onPress={() => void toggleFavorite()} />
        </View>
        <Text style={[styles.description, { color: c.fg }]}>{listingDescription(listing, locale)}</Text>
        {similar.length > 0 && (
          <View style={styles.similar}>
            <Heading>{t.listing.similar}</Heading>
            {similar.map((other) => (
              <ListingCard key={other.id} listing={other} gelPerUsd={gelPerUsd} onSignIn={toSignIn} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: space.xl },
  body: { padding: space.lg, gap: space.md },
  price: { fontSize: 24, fontWeight: "700" },
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, fontSize: 12, overflow: "hidden" },
  actions: { gap: space.sm },
  description: { fontSize: 16, lineHeight: 24 },
  similar: { gap: space.lg, marginTop: space.lg },
});
