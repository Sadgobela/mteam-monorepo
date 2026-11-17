import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { METRO_CITY, placeLabel, popularCities } from "@mteam/shared";
import { useBarSpace } from "@/components/TabBar";
import { ChipRow, Note, ScreenState, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { fill, useLocale } from "@/lib/i18n";
import { radius, space, useColors } from "@/lib/theme";
import { useLoad } from "@/lib/use-load";

const deals = ["sale", "rent"] as const;
const rooms = [1, 2, 3, 4];

/** Typical apartment prices per m² by district and room count, as on the site's prices page. */
export default function PricesScreen() {
  const c = useColors();
  const { locale, t } = useLocale();
  const barSpace = useBarSpace();
  const [deal, setDeal] = useState<(typeof deals)[number]>("sale");
  const [city, setCity] = useState<string>(METRO_CITY);
  const { data, state, retry } = useLoad(useCallback(() => api.prices(city, deal), [city, deal]));
  const stats = state === "ready" ? data.stats : [];
  const districts = [...new Set(stats.map((stat) => stat.district))];
  const cell = (district: string, count: number) => stats.find((stat) => stat.district === district && stat.rooms === count)?.median;

  let table;
  if (state !== "ready") table = <ScreenState state={state} onRetry={retry} />;
  else if (districts.length === 0) table = <ScreenState state="empty" empty={t.market.statsEmpty} />;
  else
    table = (
      <View testID="prices" style={[styles.table, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={[styles.line, { borderColor: c.line }]}>
          <Text style={[styles.district, styles.head, { color: c.muted }]}>{t.market.district}</Text>
          {rooms.map((count) => (
            <Text key={count} style={[styles.value, styles.head, { color: c.muted }]}>
              {fill(count === rooms[rooms.length - 1] ? t.market.roomsPlus : t.market.rooms, { count })}
            </Text>
          ))}
        </View>
        {districts.map((district) => (
          <View key={district} style={[styles.line, { borderColor: c.line }]}>
            <Text style={[styles.district, { color: c.fg }]}>{placeLabel(district, locale)}</Text>
            {rooms.map((count) => {
              const median = cell(district, count);
              return (
                <Text key={count} style={[styles.value, { color: median === undefined ? c.muted : c.fg }]}>
                  {median === undefined ? "–" : `$${median.toLocaleString("en-US")}`}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    );

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]}>
      <Note>{t.market.statsHint}</Note>
      <Segmented options={deals} value={deal} onChange={setDeal} label={(option) => t.deal[option]} />
      <ChipRow scroll options={popularCities} value={city} onChange={(next) => next && setCity(next)} label={(option) => placeLabel(option, locale)} />
      {table}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md },
  table: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  line: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { fontSize: 12, fontWeight: "600" },
  district: { flex: 1.4, fontSize: 14 },
  value: { flex: 1, fontSize: 13, textAlign: "right" },
});
