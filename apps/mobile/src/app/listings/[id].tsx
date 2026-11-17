import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { listingDescription } from "@mteam/shared";
import { ListingCard } from "@/components/ListingCard";
import { toSignIn } from "@/components/SignInPrompt";
import { useBarSpace } from "@/components/TabBar";
import { Button, dimWhenPressed, Heading, Note, ScreenState } from "@/components/ui";
import { api, type ListingPage } from "@/lib/api";
import { cardTitle, factList, priceLine, whatsappLink } from "@/lib/format";
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
  const [photo, setPhoto] = useState(0);
  const barSpace = useBarSpace();

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

  const facts = factList(listing, t);
  const showPhoto = (event: NativeSyntheticEvent<NativeScrollEvent>) => setPhoto(Math.round(event.nativeEvent.contentOffset.x / width));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: barSpace }}>
      <Stack.Screen options={{ title: priceLine(listing, t, gelPerUsd) }} />
      <View>
        <ScrollView testID="gallery" horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={showPhoto}>
          {listing.images.map((uri, index) => (
            <Image key={uri} source={{ uri }} style={{ width, aspectRatio: 4 / 3 }} contentFit="cover" transition={150} accessibilityLabel={`${t.card.photo} ${index + 1}`} />
          ))}
        </ScrollView>
        {listing.images.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>{`${photo + 1} / ${listing.images.length}`}</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? t.favorites.remove : t.favorites.add}
          accessibilityState={{ selected: favorite }}
          onPress={() => void toggleFavorite()}
          style={dimWhenPressed([styles.heart, { backgroundColor: c.glass }])}
        >
          <Ionicons name={favorite ? "heart" : "heart-outline"} size={22} color={favorite ? c.danger : c.fg} />
        </Pressable>
      </View>
      <View style={styles.body}>
        {listing.verified && (
          <View style={[styles.badge, { backgroundColor: c.brandSoft }]}>
            <Ionicons name="checkmark-circle" size={14} color={c.brandDeep} />
            <Text style={[styles.badgeText, { color: c.brandDeep }]}>MTeam Verified</Text>
          </View>
        )}
        <Text style={[styles.price, { color: c.fg }]}>{priceLine(listing, t, gelPerUsd)}</Text>
        <Heading>{cardTitle(listing, locale, t)}</Heading>
        {listing.address ? (
          <View style={styles.line}>
            <Ionicons name="location-outline" size={16} color={c.muted} />
            <Note>{listing.address}</Note>
          </View>
        ) : null}
        <View style={styles.facts}>
          {facts.map((fact) => (
            <View key={fact.kind} style={[styles.fact, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Ionicons name={factIcons[fact.kind]} size={20} color={c.brandDeep} />
              <Text style={[styles.factText, { color: c.fg }]}>{fact.text}</Text>
            </View>
          ))}
        </View>
        {listing.agent && (
          <View style={[styles.agent, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Ionicons name="person-circle-outline" size={40} color={c.brand} />
            <Text style={[styles.agentName, { color: c.fg }]}>{[listing.agent.name, listing.agent.branch].filter(Boolean).join(" · ")}</Text>
          </View>
        )}
        {listing.hidePhone ? null : (
          <View style={styles.actions}>
            <View style={styles.grow}>
              <Button icon="call" label={t.listing.call} busy={phoneBusy} onPress={() => void contact((phone) => `tel:${phone}`)} />
            </View>
            <View style={styles.grow}>
              <Button icon="logo-whatsapp" color={c.wa} label={t.listing.whatsapp} disabled={phoneBusy} onPress={() => void contact(whatsappLink)} />
            </View>
          </View>
        )}
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

const factIcons = { area: "resize-outline", rooms: "bed-outline", floor: "layers-outline" } as const;

const styles = StyleSheet.create({
  counter: { position: "absolute", right: space.md, bottom: space.md, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, backgroundColor: "rgba(20, 16, 25, 0.6)" },
  counterText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  heart: { position: "absolute", top: space.md, right: space.md, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  body: { padding: space.lg, gap: space.md },
  badge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  price: { fontSize: 28, fontWeight: "800" },
  line: { flexDirection: "row", alignItems: "center", gap: space.xs },
  facts: { flexDirection: "row", gap: space.sm },
  fact: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.xs, alignItems: "flex-start" },
  factText: { fontSize: 14, fontWeight: "600" },
  agent: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  agentName: { flex: 1, fontSize: 15, fontWeight: "600" },
  actions: { flexDirection: "row", gap: space.sm },
  grow: { flex: 1 },
  description: { fontSize: 16, lineHeight: 24 },
  similar: { gap: space.lg, marginTop: space.lg },
});
