import { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { placeLabel } from "@mteam/shared";
import { BrokerRow, ListingStack } from "@/components/People";
import { useBarSpace } from "@/components/TabBar";
import { Heading, Note, ScreenState } from "@/components/ui";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { space } from "@/lib/theme";
import { useLoad } from "@/lib/use-load";

/** One MTeam branch, as on the site: its city, its brokers and their listings. */
export default function BranchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale, t } = useLocale();
  const barSpace = useBarSpace();
  const { data, state, retry } = useLoad(useCallback(() => api.branch(id), [id]));
  if (state !== "ready") return <ScreenState state={state} onRetry={retry} />;
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]}>
      <Stack.Screen options={{ title: data.branch.name }} />
      <View style={styles.section}>
        <Heading>{data.branch.name}</Heading>
        <Note>{placeLabel(data.branch.city, locale)}</Note>
      </View>
      <View style={styles.section}>
        <Heading>{t.brokers.team}</Heading>
        {data.brokers.map((broker) => (
          <BrokerRow key={broker.id} broker={broker} />
        ))}
      </View>
      <ListingStack listings={data.listings} gelPerUsd={data.gelPerUsd} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ page: { padding: space.lg, gap: space.xl }, section: { gap: space.sm } });
