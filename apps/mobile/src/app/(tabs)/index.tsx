import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { FALLBACK_GEL_PER_USD, placeLabel, popularCities, propertyTypes, sortOrders, type PublicListing, type SortOrder } from "@mteam/shared";
import { ListingCard } from "@/components/ListingCard";
import { toSignIn } from "@/components/SignInPrompt";
import { useBarSpace } from "@/components/TabBar";
import { Button, ChipRow, dimWhenPressed, Field, Note, ScreenState, Segmented } from "@/components/ui";
import { api, ApiError, fromSearch, toSearch, type Query } from "@/lib/api";
import { fill, useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";

const deals = ["sale", "rent", "daily"] as const;
const rooms = ["1", "2", "3", "4", "5"] as const;
const sortLabels = { new: "sortNew", asc: "sortAsc", desc: "sortDesc" } as const;

interface Results {
  listings: PublicListing[];
  total: number;
  page: number;
  pageSize: number;
  gelPerUsd: number;
}

/** The filters a search starts from: those in the screen's address (a saved search opened from a notification), else sales. */
const startFrom = (asked: string): Query => (asked ? fromSearch(asked) : { deal: "sale" });

/** Search with the filters people use most, and the results under them, a page at a time, to save as on the site. */
export default function SearchScreen() {
  const c = useColors();
  const { locale, t } = useLocale();
  const barSpace = useBarSpace();
  const session = useSession();
  const asked = toSearch(useLocalSearchParams<Query>());
  const [shownFor, setShownFor] = useState(asked);
  const [filters, setFilters] = useState<Query>(() => startFrom(asked));
  const [results, setResults] = useState<Results>({ listings: [], total: 0, page: 1, pageSize: 0, gelPerUsd: FALLBACK_GEL_PER_USD });
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [more, setMore] = useState(false);
  // Price and rooms fold away so the results start on the first screen.
  const [allFilters, setAllFilters] = useState(false);
  // The filters of the results on the screen, which saving keeps (not edits not yet searched), and the last one saved.
  const [searched, setSearched] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A new address (another saved search opened) starts over from its filters.
  if (asked !== shownFor) {
    setShownFor(asked);
    setFilters(startFrom(asked));
    setState("loading");
  }

  /** Fetches a page; the caller shows that it is loading. */
  const load = useCallback(
    (query: Query, page = 1) =>
      api
        .search({ ...query, page: String(page) })
        .then(
          (next) => {
            setResults((current) => (page === 1 ? next : { ...next, listings: [...current.listings, ...next.listings] }));
            // The order of the results is not part of a saved search.
            if (page === 1) setSearched(toSearch({ ...query, sort: undefined }).slice(1));
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
    void load(startFrom(asked));
  }, [load, asked]);

  const set = (name: string) => (value: string | undefined) => setFilters((current) => ({ ...current, [name]: value }));
  const search = (query: Query) => {
    setState("loading");
    void load(query);
  };
  const sortBy = (sort: SortOrder | undefined) => {
    const next = { ...filters, sort: sort && sort !== "new" ? sort : undefined };
    setFilters(next);
    search(next);
  };
  const loadMore = (page: number) => {
    setMore(true);
    void load(filters, page);
  };
  const hasMore = state === "ready" && results.listings.length < results.total;
  const isSaved = saved === searched;
  const save = async () => {
    if (!session.user) return toSignIn();
    setSaving(true);
    try {
      await api.saveSearch(searched);
      setSaved(searched);
    } catch (error) {
      // At the limit the list is where one can be removed to make room, as on the site.
      if (error instanceof ApiError && error.code === "limit") router.push("/saved-searches");
      else Alert.alert(t.feedback.failed);
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View style={styles.top}>
      <Text accessibilityRole="header" style={[styles.heading, { color: c.fg }]}>
        {t.mobile.searchHeading}
      </Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Segmented options={deals} value={(filters.deal as (typeof deals)[number] | undefined) ?? "sale"} onChange={set("deal")} label={(deal) => t.deal[deal]} />
        <ChipRow scroll options={propertyTypes} value={filters.type as (typeof propertyTypes)[number] | undefined} onChange={set("type")} label={(type) => t.propertyType[type]} />
        <ChipRow scroll options={popularCities} value={filters.city as string | undefined} onChange={set("city")} label={(city) => placeLabel(city, locale)} />
        {allFilters && (
          <>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Field label={t.search.priceMin} keyboardType="number-pad" value={(filters.priceMin as string) ?? ""} onChangeText={set("priceMin")} />
              </View>
              <View style={styles.grow}>
                <Field label={t.search.priceMax} keyboardType="number-pad" value={(filters.priceMax as string) ?? ""} onChangeText={set("priceMax")} />
              </View>
            </View>
            <Note>{t.search.rooms}</Note>
            <ChipRow options={rooms} value={filters.rooms as (typeof rooms)[number] | undefined} onChange={set("rooms")} label={(count) => count} />
          </>
        )}
        <View style={styles.row}>
          {!allFilters && (
            <View style={styles.grow}>
              <Button quiet label={t.ui.filters} onPress={() => setAllFilters(true)} />
            </View>
          )}
          <View style={styles.grow}>
            <Button label={t.search.submit} onPress={() => search(filters)} />
          </View>
        </View>
      </View>
      {state === "ready" && (
        <View style={styles.resultsHead}>
          <View style={styles.foundRow}>
            <Text style={[styles.found, { color: c.fg }]}>{fill(t.results.found, { count: results.total })}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSaved ? t.saved.done : t.saved.save}
              accessibilityState={{ disabled: isSaved || saving, busy: saving }}
              disabled={isSaved || saving}
              onPress={() => void save()}
              style={dimWhenPressed([styles.save, { backgroundColor: c.brandSoft }])}
            >
              {saving ? <ActivityIndicator size="small" color={c.brandDeep} /> : <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={16} color={c.brandDeep} />}
              <Text style={[styles.saveText, { color: c.brandDeep }]}>{isSaved ? t.saved.done : t.saved.save}</Text>
            </Pressable>
          </View>
          <ChipRow scroll options={sortOrders} value={(filters.sort as SortOrder | undefined) ?? "new"} onChange={sortBy} label={(sort) => t.results[sortLabels[sort]]} />
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      contentContainerStyle={[styles.list, { paddingBottom: barSpace }]}
      keyboardShouldPersistTaps="handled"
      data={state === "ready" ? results.listings : []}
      keyExtractor={(listing) => String(listing.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <ListingCard listing={item} gelPerUsd={results.gelPerUsd} onSignIn={toSignIn} />}
      ListEmptyComponent={state === "ready" ? <ScreenState state="empty" empty={t.search.empty} /> : <ScreenState state={state} onRetry={() => search(filters)} />}
      ListFooterComponent={hasMore ? <Button quiet busy={more} label={t.mobile.loadMore} onPress={() => loadMore(results.page + 1)} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.lg },
  top: { gap: space.lg },
  heading: { fontSize: 26, fontWeight: "800", lineHeight: 32 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.md },
  row: { flexDirection: "row", gap: space.md },
  grow: { flex: 1 },
  resultsHead: { gap: space.sm },
  foundRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  found: { flex: 1, fontSize: 16, fontWeight: "700" },
  save: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, borderRadius: radius.pill, paddingHorizontal: space.md },
  saveText: { fontSize: 14, fontWeight: "600" },
});
