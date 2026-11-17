import { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Avatar, ListingStack } from "@/components/People";
import { useBarSpace } from "@/components/TabBar";
import { Button, Heading, Note, ScreenState } from "@/components/ui";
import { api } from "@/lib/api";
import { whatsappLink } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { radius, space, useColors } from "@/lib/theme";
import { useLoad } from "@/lib/use-load";

/** A broker's page, as on the site: photo, branch, call and WhatsApp (a broker's number is public), bio and listings. */
export default function BrokerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t } = useLocale();
  const barSpace = useBarSpace();
  const [busy, setBusy] = useState(false);
  const { data, state, retry } = useLoad(useCallback(() => api.broker(id), [id]));
  if (state !== "ready") return <ScreenState state={state} onRetry={retry} />;
  const { broker } = data;
  const open = async (url: string) => {
    setBusy(true);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t.mobile.callFailed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]}>
      <Stack.Screen options={{ title: broker.name }} />
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.who}>
          <Avatar name={broker.name} url={broker.photoUrl} size={72} />
          <View style={styles.grow}>
            <Heading>{broker.name}</Heading>
            <Text style={{ color: c.muted }}>{[t.listing.broker, broker.branch].filter(Boolean).join(" · ")}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <View style={styles.grow}>
            <Button icon="call" label={t.listing.call} disabled={busy} onPress={() => void open(`tel:${broker.phone}`)} />
          </View>
          <View style={styles.grow}>
            <Button icon="logo-whatsapp" color={c.wa} label={t.listing.whatsapp} disabled={busy} onPress={() => void open(whatsappLink(broker.phone))} />
          </View>
        </View>
      </View>
      {broker.bio ? <Note>{broker.bio}</Note> : null}
      <ListingStack listings={data.listings} gelPerUsd={data.gelPerUsd} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg },
  card: { gap: space.lg, padding: space.lg, borderWidth: 1, borderRadius: radius.lg },
  who: { flexDirection: "row", alignItems: "center", gap: space.md },
  grow: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", gap: space.sm },
});
