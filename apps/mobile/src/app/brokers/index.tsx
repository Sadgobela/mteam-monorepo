import { ScrollView, StyleSheet, View } from "react-native";
import { BranchRow, BrokerRow } from "@/components/People";
import { useBarSpace } from "@/components/TabBar";
import { Heading, ScreenState } from "@/components/ui";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { space } from "@/lib/theme";
import { useLoad } from "@/lib/use-load";

/** MTeam's branches and brokers, as on the site's brokers page. */
export default function BrokersScreen() {
  const { t } = useLocale();
  const barSpace = useBarSpace();
  const { data, state, retry } = useLoad(api.brokers);
  if (state !== "ready") return <ScreenState state={state} onRetry={retry} />;
  if (data.brokers.length === 0) return <ScreenState state="empty" empty={t.brokers.empty} />;
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]}>
      {data.branches.length > 0 && (
        <View style={styles.section}>
          <Heading>{t.brokers.branches}</Heading>
          {data.branches.map((branch) => (
            <BranchRow key={branch.id} branch={branch} />
          ))}
        </View>
      )}
      <View style={styles.section}>
        <Heading>{t.brokers.team}</Heading>
        {data.brokers.map((broker) => (
          <BrokerRow key={broker.id} broker={broker} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ page: { padding: space.lg, gap: space.xl }, section: { gap: space.sm } });
