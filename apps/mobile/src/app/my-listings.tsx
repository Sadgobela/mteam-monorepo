import { useCallback, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { formatDay, formatPrice, thumbUrl } from "@mteam/shared";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useBarSpace } from "@/components/TabBar";
import { Button, ChipRow, Note, ScreenState } from "@/components/ui";
import { api, myListingTabs, type MyListing, type MyListingsPage, type MyListingTab } from "@/lib/api";
import { cardTitle } from "@/lib/format";
import { fill, useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";

/**
 * Everything the user posted, a tab for each status as on the site, each listing with its numbers and what can be done
 * with it now: open, edit, move up, renew, take down, or delete a draft. Read again whenever the screen comes back into
 * view, so an edit saved on the next screen shows.
 */
export default function MyListingsScreen() {
  const barSpace = useBarSpace();
  const { t } = useLocale();
  const session = useSession();
  const [chosen, setChosen] = useState<MyListingTab>();
  const [page, setPage] = useState<MyListingsPage | null>(null);
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [busy, setBusy] = useState<number | null>(null);
  /** The latest request, so the answer for a tab left behind is never shown under another. */
  const latest = useRef(0);

  const load = useCallback(async (tab: MyListingTab | undefined) => {
    const asked = ++latest.current;
    try {
      const next = await api.myListings(tab);
      if (asked !== latest.current) return;
      setPage(next);
      setState("ready");
    } catch {
      if (asked === latest.current) setState("failed");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(chosen);
    }, [load, chosen]),
  );

  const retry = () => {
    setState("loading");
    void load(chosen);
  };
  if (!session.user) return <SignInPrompt />;
  if (page === null) return <ScreenState state={state === "failed" ? "failed" : "loading"} onRetry={retry} />;

  const total = myListingTabs.reduce((sum, tab) => sum + (tab === "expiring" ? 0 : page.counts[tab]), 0);
  if (total === 0) return <ScreenState state="empty" empty={t.my.empty} />;

  const choose = (tab: MyListingTab | undefined) => {
    // The chosen tab pressed again stays chosen: one is always open.
    if (!tab) return;
    setState("loading");
    setChosen(tab);
  };
  /** Runs an action on one listing, says how it went, and reads the list again, where the listing may have moved. */
  const act = async (id: number, work: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await work();
      Alert.alert(done);
      await load(chosen);
    } catch {
      Alert.alert(t.feedback.failed);
    } finally {
      setBusy(null);
    }
  };
  const confirm = (question: string, yes: () => void) =>
    Alert.alert(question, undefined, [
      { text: t.confirm.no, style: "cancel" },
      { text: t.confirm.yes, style: "destructive", onPress: yes },
    ]);

  const tabs = (
    <ChipRow
      scroll
      options={myListingTabs}
      value={chosen ?? page.tab}
      onChange={choose}
      label={(tab) => fill(t.myListings.tab, { name: t.myListings.tabs[tab], count: page.counts[tab] })}
    />
  );
  return (
    <FlatList
      contentContainerStyle={[styles.list, { paddingBottom: barSpace }]}
      data={state === "ready" ? page.listings : []}
      keyExtractor={(mine) => String(mine.id)}
      ListHeaderComponent={tabs}
      renderItem={({ item }) => (
        <Row
          mine={item}
          busy={busy === item.id}
          onBump={() => void act(item.id, () => api.listingAction(item.id, "bump"), t.feedback.bumped)}
          onRenew={() => void act(item.id, () => api.listingAction(item.id, "renew"), t.feedback.renewed)}
          onArchive={() => confirm(t.my.confirmArchive, () => void act(item.id, () => api.listingAction(item.id, "archive"), t.feedback.archived))}
          onDelete={() => confirm(t.ui.confirmDeleteDraft, () => void act(item.id, () => api.deleteDraft(item.id), t.ui.draftDeleted))}
        />
      )}
      ListEmptyComponent={state === "ready" ? <Note>{t.myListings.emptyTab}</Note> : <ScreenState state={state} onRetry={retry} />}
    />
  );
}

function Row({
  mine,
  busy,
  onBump,
  onRenew,
  onArchive,
  onDelete,
}: {
  mine: MyListing;
  busy: boolean;
  onBump: () => void;
  onRenew: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const c = useColors();
  const { locale, t } = useLocale();
  const my = t.myListings;
  const { status } = mine;
  const draft = status === "DRAFT";
  const cover = mine.images[0];
  // A draft holds only what was filled in so far: a price of 0 or an empty address is left out rather than shown.
  const facts = [mine.price > 0 ? formatPrice(mine.price, mine.currency) : "", mine.address].filter(Boolean).join(" · ");
  const nextBump =
    mine.nextBumpAt && new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tbilisi" }).format(new Date(mine.nextBumpAt));
  return (
    <View testID={`mine-${mine.id}`} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.top}>
        {cover ? (
          <Image source={{ uri: thumbUrl(cover) }} style={styles.thumb} contentFit="cover" accessibilityElementsHidden />
        ) : (
          <View style={[styles.thumb, styles.empty, { backgroundColor: c.brandSoft }]}>
            <Ionicons name="image-outline" size={24} color={c.brand} />
          </View>
        )}
        <View style={styles.grow}>
          <Text numberOfLines={2} style={[styles.title, { color: c.fg }]}>
            {mine.title || t.ui.draftTitle}
          </Text>
          <Text style={{ color: c.muted }}>{fill(my.number, { id: mine.id })}</Text>
          {/* A draft is named by what it is so far, such as "For sale: apartment, Vake", as nobody has seen it yet. */}
          {draft && <Text style={{ color: c.muted }}>{cardTitle(mine, locale, t)}</Text>}
          {facts !== "" && <Text style={{ color: c.muted }}>{facts}</Text>}
        </View>
      </View>
      <Text style={[styles.status, { color: c.brandDeep, backgroundColor: c.brandSoft }]}>{t.my.status[status]}</Text>
      {!draft && (
        <Text style={{ color: c.muted }}>
          {[fill(my.views, { count: mine.views }), fill(my.phoneReveals, { count: mine.phoneReveals }), fill(my.favorites, { count: mine.favorites }), fill(my.conversations, { count: mine.conversations })].join(" · ")}
        </Text>
      )}
      {mine.marketLevel ? <Note>{`${t.market.heading}: ${t.market.levels[mine.marketLevel - 1]}`}</Note> : null}
      {mine.expiresAt && <Note>{fill(my.expires, { date: formatDay(mine.expiresAt, locale) })}</Note>}
      {status === "ARCHIVED" && mine.canRenew && <Note tone="danger">{my.expired}</Note>}
      {nextBump && <Note>{fill(my.nextBump, { time: nextBump })}</Note>}
      <View style={styles.actions}>
        {status === "ACTIVE" && <Button quiet label={my.open} onPress={() => router.push(`/listings/${mine.id}`)} />}
        <Button quiet label={my.edit} onPress={() => router.push(`/edit/${mine.id}`)} />
        {mine.canBump && <Button quiet label={my.bump} busy={busy} onPress={onBump} />}
        {mine.canRenew && <Button quiet label={my.renew} busy={busy} onPress={onRenew} />}
        {(status === "ACTIVE" || status === "PENDING") && <Button quiet label={t.my.archive} disabled={busy} onPress={onArchive} />}
        {draft && <Button quiet label={t.ui.deleteDraft} disabled={busy} onPress={onDelete} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.lg },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  top: { flexDirection: "row", gap: space.md },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  empty: { alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "600" },
  status: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, overflow: "hidden" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
