import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { thumbUrl, type PublicListing } from "@mteam/shared";
import { cardTitle, factsLine, priceLine } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { dimWhenPressed } from "./ui";
import { radius, space, useColors } from "@/lib/theme";

/**
 * A listing in a list, as a card on the site: the cover photo with the Verified badge and a heart on it, then the price,
 * the title and the facts. The heart asks a signed-out user to sign in.
 */
export function ListingCard({ listing, gelPerUsd, onSignIn }: { listing: PublicListing; gelPerUsd: number; onSignIn: () => void }) {
  const c = useColors();
  const { locale, t } = useLocale();
  const session = useSession();
  const favorite = session.favoriteIds.has(listing.id);
  const cover = listing.images[0];
  const toggle = async () => {
    if (!(await session.toggleFavorite(listing.id))) onSignIn();
  };
  return (
    // One style object: Link's asChild (Slot) refuses an array of styles, and the whole list failed to render.
    <Link href={`/listings/${listing.id}`} asChild>
      <Pressable accessibilityRole="link" style={StyleSheet.flatten([styles.card, { backgroundColor: c.surface, borderColor: c.line }])}>
        <View>
          {cover ? (
            <Image source={{ uri: thumbUrl(cover) }} style={styles.photo} contentFit="cover" transition={150} accessibilityLabel={t.card.photo} />
          ) : (
            <View testID="no-photo" style={[styles.photo, styles.empty, { backgroundColor: c.brandSoft }]}>
              <Ionicons name="image-outline" size={32} color={c.brand} />
            </View>
          )}
          {listing.verified && (
            <View style={[styles.verified, { backgroundColor: c.action }]}>
              <Ionicons name="checkmark-circle" size={14} color={c.onAction} />
              <Text style={[styles.verifiedText, { color: c.onAction }]}>MTeam Verified</Text>
            </View>
          )}
          {listing.images.length > 1 && (
            <View style={styles.count}>
              <Ionicons name="images-outline" size={12} color="#ffffff" />
              <Text style={styles.countText}>{listing.images.length}</Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite ? t.favorites.remove : t.favorites.add}
            accessibilityState={{ selected: favorite }}
            hitSlop={8}
            onPress={toggle}
            style={dimWhenPressed([styles.heart, { backgroundColor: c.glass }])}
          >
            <Ionicons name={favorite ? "heart" : "heart-outline"} size={20} color={favorite ? c.danger : c.fg} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={[styles.price, { color: c.fg }]}>{priceLine(listing, t, gelPerUsd)}</Text>
          <Text style={[styles.title, { color: c.fg }]} numberOfLines={2}>
            {cardTitle(listing, locale, t)}
          </Text>
          <View style={styles.facts}>
            <Ionicons name="resize-outline" size={14} color={c.muted} />
            <Text style={{ color: c.muted }}>{factsLine(listing, t)}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  photo: { width: "100%", aspectRatio: 4 / 3 },
  empty: { alignItems: "center", justifyContent: "center" },
  verified: { position: "absolute", top: space.sm, left: space.sm, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
  verifiedText: { fontSize: 12, fontWeight: "700" },
  count: { position: "absolute", bottom: space.sm, left: space.sm, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, backgroundColor: "rgba(20, 16, 25, 0.55)" },
  countText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  heart: { position: "absolute", top: space.sm, right: space.sm, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  body: { padding: space.md, gap: space.xs },
  price: { fontSize: 20, fontWeight: "800" },
  title: { fontSize: 15, lineHeight: 20 },
  facts: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
