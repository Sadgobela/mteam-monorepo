import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { thumbUrl, type PublicListing } from "@mteam/shared";
import { cardTitle, factsLine, priceLine } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";

/** A listing in a list: its cover photo, price, title and facts, with a heart for signed-in users. */
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
        {cover ? (
          <Image source={{ uri: thumbUrl(cover) }} style={styles.photo} contentFit="cover" accessibilityLabel={t.card.photo} />
        ) : (
          <View style={[styles.photo, { backgroundColor: c.brandSoft }]} />
        )}
        <View style={styles.body}>
          <View style={styles.top}>
            <Text style={[styles.price, { color: c.fg }]}>{priceLine(listing, t, gelPerUsd)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={favorite ? t.favorites.remove : t.favorites.add} hitSlop={12} onPress={toggle}>
              <Text style={[styles.heart, { color: c.brand }]}>{favorite ? "♥" : "♡"}</Text>
            </Pressable>
          </View>
          <Text style={{ color: c.fg }} numberOfLines={2}>
            {cardTitle(listing, locale, t)}
          </Text>
          <Text style={{ color: c.muted }}>{factsLine(listing, t)}</Text>
          {listing.verified && <Text style={[styles.badge, { color: c.brandDeep, backgroundColor: c.brandSoft }]}>MTeam Verified</Text>}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  photo: { width: "100%", aspectRatio: 4 / 3 },
  body: { padding: space.md, gap: space.xs },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { fontSize: 18, fontWeight: "700" },
  heart: { fontSize: 24 },
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, fontSize: 12, overflow: "hidden" },
});
