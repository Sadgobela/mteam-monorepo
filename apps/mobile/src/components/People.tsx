import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { placeLabel, type PublicListing } from "@mteam/shared";
import type { BranchCard, BrokerCard } from "@/lib/api";
import { initials } from "@/lib/format";
import { fill, useLocale } from "@/lib/i18n";
import { radius, space, useColors } from "@/lib/theme";
import { ListingCard } from "./ListingCard";
import { toSignIn } from "./SignInPrompt";
import { dimWhenPressed, Note } from "./ui";

/** A person's photo, or the initials of their name without one. Decorative: the name is always shown next to it. */
export function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const c = useColors();
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <Image source={{ uri: url }} style={round} contentFit="cover" accessibilityElementsHidden />;
  return (
    <View style={[round, styles.initials, { backgroundColor: c.brandSoft }]} accessibilityElementsHidden>
      <Text style={[styles.initialsText, { color: c.brandDeep, fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

/** A row in a list that opens another screen: a picture, a name, a line under it and an arrow. */
function Row({ label, detail, picture, onPress }: { label: string; detail: string; picture: ReactNode; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${detail}`} onPress={onPress} style={dimWhenPressed([styles.row, { backgroundColor: c.surface, borderColor: c.line }])}>
      {picture}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.name, { color: c.fg }]}>
          {label}
        </Text>
        <Text numberOfLines={2} style={{ color: c.muted }}>
          {detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
}

export function BrokerRow({ broker }: { broker: BrokerCard }) {
  const { t } = useLocale();
  const detail = [broker.branch, fill(t.brokers.listings, { count: broker.listingCount })].filter(Boolean).join(" · ");
  return <Row label={broker.name} detail={detail} picture={<Avatar name={broker.name} />} onPress={() => router.push(`/brokers/${broker.id}`)} />;
}

export function BranchRow({ branch }: { branch: BranchCard }) {
  const c = useColors();
  const { locale, t } = useLocale();
  const detail = [placeLabel(branch.city, locale), fill(t.brokers.people, { count: branch.brokerCount }), fill(t.brokers.listings, { count: branch.listingCount })].join(" · ");
  const picture = (
    <View style={[styles.office, { backgroundColor: c.brandSoft }]}>
      <Ionicons name="business-outline" size={20} color={c.brandDeep} />
    </View>
  );
  return <Row label={branch.name} detail={detail} picture={picture} onPress={() => router.push(`/branches/${branch.id}`)} />;
}

/** The listings on someone's page, one card under another, or a note when there are none. */
export function ListingStack({ listings, gelPerUsd }: { listings: PublicListing[]; gelPerUsd: number }) {
  const { t } = useLocale();
  if (listings.length === 0) return <Note>{t.search.empty}</Note>;
  return (
    <View style={styles.stack}>
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} gelPerUsd={gelPerUsd} onSignIn={toSignIn} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { alignItems: "center", justifyContent: "center" },
  initialsText: { fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600" },
  office: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  stack: { gap: space.lg },
});
