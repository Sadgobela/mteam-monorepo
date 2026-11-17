import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { FALLBACK_GEL_PER_USD, placeLabel, popularCities, propertyTypes, type PublicListing } from "@mteam/shared";
import { ListingCard } from "@/components/ListingCard";
import { toSignIn } from "@/components/SignInPrompt";
import { Button, ChipRow, Field, Note, ScreenState } from "@/components/ui";
import { api, type Query } from "@/lib/api";
import { fill, useLocale } from "@/lib/i18n";
import { space } from "@/lib/theme";

const deals = ["sale", "rent", "daily"] as const;
const rooms = ["1", "2", "3", "4", "5"] as const;

interface Results {
  listings: PublicListing[];
  total: number;
  page: number;
  pageSize: number;
  gelPerUsd: number;
}

/** Search with the filters people use most, and the results under them, a page at a time. */
export default function SearchScreen() {
  const { locale, t } = useLocale();
  const [filters, setFilters] = useState<Query>({ deal: "sale" });
  const [results, setResults] = useState<Results>({ listings: [], total: 0, page: 1, pageSize: 0, gelPerUsd: FALLBACK_GEL_PER_USD });
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [more, setMore] = useState(false);
  // Price and rooms fold away so the results start on the first screen.
  const [allFilters, setAllFilters] = useState(false);

  /** Fetches a page; the caller shows that it is loading, so the first load from the effect sets no state before the answer. */
  const load = useCallback(
    (query: Query, page = 1) =>
      api
        .search({ ...query, page: String(page) })
        .then(
          (next) => {
            setResults((current) => (page === 1 ? next : { ...next, listings: [...current.listings, ...next.listings] }));
            setState("ready");
          },
          () => {
            if (page === 1) setState("failed");
          },
        )
        .finally(() => setMore(false)),
    [],
  );

  useEffect(() => {
    void load({ deal: "sale" });
  }, [load]);

  const set = (name: string) => (value: string | undefined) => setFilters((current) => ({ ...current, [name]: value }));
  const submit = () => {
    setState("loading");
    void load(filters);
  };
  const loadMore = (page: number) => {
    setMore(true);
    void load(filters, page);
  };
  const hasMore = state === "ready" && results.listings.length < results.total;

  const header = (
    <View style={styles.filters}>
      <ChipRow scroll options={deals} value={filters.deal as (typeof deals)[number] | undefined} onChange={set("deal")} label={(deal) => t.deal[deal]} />
      <ChipRow scroll options={propertyTypes} value={filters.type as (typeof propertyTypes)[number] | undefined} onChange={set("type")} label={(type) => t.propertyType[type]} />
      <ChipRow scroll options={popularCities} value={filters.city as string | undefined} onChange={set("city")} label={(city) => placeLabel(city, locale)} />
      {allFilters ? (
        <>
          <View style={styles.row}>
            <View style={styles.half}>
              <Field label={t.search.priceMin} keyboardType="number-pad" value={(filters.priceMin as string) ?? ""} onChangeText={set("priceMin")} />
            </View>
            <View style={styles.half}>
              <Field label={t.search.priceMax} keyboardType="number-pad" value={(filters.priceMax as string) ?? ""} onChangeText={set("priceMax")} />
            </View>
          </View>
          <Note>{t.search.rooms}</Note>
          <ChipRow options={rooms} value={filters.rooms as (typeof rooms)[number] | undefined} onChange={set("rooms")} label={(count) => count} />
        </>
      ) : (
        <Button quiet label={t.ui.filters} onPress={() => setAllFilters(true)} />
      )}
      <Button label={t.search.submit} onPress={submit} />
      {state === "ready" && <Note>{fill(t.results.found, { count: results.total })}</Note>}
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={state === "ready" ? results.listings : []}
      keyExtractor={(listing) => String(listing.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <ListingCard listing={item} gelPerUsd={results.gelPerUsd} onSignIn={toSignIn} />}
      ListEmptyComponent={state === "ready" ? <ScreenState state="empty" empty={t.search.empty} /> : <ScreenState state={state === "loading" ? "loading" : "failed"} onRetry={submit} />}
      ListFooterComponent={hasMore ? <Button quiet busy={more} label={t.mobile.loadMore} onPress={() => loadMore(results.page + 1)} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.lg },
  filters: { gap: space.md },
  row: { flexDirection: "row", gap: space.md },
  half: { flex: 1 },
});
