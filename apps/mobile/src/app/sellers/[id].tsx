import { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Avatar, ListingStack } from "@/components/People";
import { useBarSpace } from "@/components/TabBar";
import { Heading, Note, ScreenState } from "@/components/ui";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { space } from "@/lib/theme";
import { useLoad } from "@/lib/use-load";

/** A private seller's page, as on the site: their name and photo when they gave them, and their listings. */
export default function SellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const barSpace = useBarSpace();
  const { data, state, retry } = useLoad(useCallback(() => api.seller(id), [id]));
  if (state !== "ready") return <ScreenState state={state} onRetry={retry} />;
  const { name, avatarUrl } = data.seller;
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]}>
      {name ? (
        <View style={styles.who}>
          <Avatar name={name} url={avatarUrl} size={56} />
          <View style={styles.grow}>
            <Heading>{name}</Heading>
            <Note>{t.listing.sellerHeading}</Note>
          </View>
        </View>
      ) : (
        <Heading>{t.listing.sellerHeading}</Heading>
      )}
      <ListingStack listings={data.listings} gelPerUsd={data.gelPerUsd} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ page: { padding: space.lg, gap: space.lg }, who: { flexDirection: "row", alignItems: "center", gap: space.md }, grow: { flex: 1 } });
