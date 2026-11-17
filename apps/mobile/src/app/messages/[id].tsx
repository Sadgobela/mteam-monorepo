import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_MESSAGE } from "@mteam/shared";
import { SignInPrompt } from "@/components/SignInPrompt";
import { dimWhenPressed, ScreenState } from "@/components/ui";
import { api, type Chat } from "@/lib/api";
import { chatDay, chatTime, initials } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";

/** How often an open chat asks for new messages, as the site's chat page refreshes itself. */
export const CHAT_POLL_MS = 10_000;

/** Back to where the chat was opened from, or to the list when it was opened from a notification. */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/messages");
}

/**
 * One chat: the other person and the listing at the top, messages as bubbles with the newest at the bottom, and a box
 * to write in that rises with the keyboard. It has its own header, so the keyboard lifts the box by exactly its height,
 * and asks for new messages every few seconds while it is open.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { locale, t } = useLocale();
  const session = useSession();
  const insets = useSafeAreaInsets();
  const [chat, setChat] = useState<Chat | null>(null);
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const signedIn = session.user !== null;

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      setChat(await api.chat(id));
      setState("ready");
    } catch {
      // A missed refresh keeps the messages already on the screen.
      setState((current) => (current === "ready" ? current : "failed"));
    }
  }, [id, signedIn]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), CHAT_POLL_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const retry = () => {
    setState("loading");
    void load();
  };
  const send = async () => {
    setSending(true);
    try {
      await api.sendMessage(id, draft.trim());
      setDraft("");
      setFailed(false);
      await load();
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const name = chat?.otherName ?? t.chat.someone;
  const messages = chat?.messages ?? [];
  const canSend = draft.trim().length > 0 && !sending;

  let body;
  if (!signedIn) body = <SignInPrompt />;
  else if (state !== "ready") body = <ScreenState state={state} onRetry={retry} />;
  else
    body = (
      <>
        <FlatList
          testID="chat"
          inverted
          style={styles.fill}
          contentContainerStyle={styles.thread}
          keyboardDismissMode="interactive"
          data={[...messages].reverse()}
          keyExtractor={(message) => message.id}
          renderItem={({ item, index }) => {
            // The list runs newest first; the message before this one in time is the next one in the list.
            const before = messages[messages.length - 2 - index];
            const day = chatDay(item.at, locale);
            return (
              <View style={styles.cell}>
                {(!before || chatDay(before.at, locale) !== day) && <Text style={[styles.day, { color: c.muted, backgroundColor: c.brandSoft }]}>{day}</Text>}
                <View testID={item.mine ? "mine" : "theirs"} style={[styles.bubble, item.mine ? [styles.mine, { backgroundColor: c.brand }] : [styles.theirs, { backgroundColor: c.surface, borderColor: c.line }]]}>
                  <Text selectable style={[styles.text, { color: item.mine ? "#ffffff" : c.fg }]}>
                    {item.body}
                  </Text>
                  <Text style={[styles.time, { color: item.mine ? "rgba(255, 255, 255, 0.75)" : c.muted }]}>{chatTime(item.at, locale)}</Text>
                </View>
              </View>
            );
          }}
        />
        {failed && (
          <Text accessibilityRole="alert" style={[styles.failed, { color: c.danger }]}>
            {t.chat.failed}
          </Text>
        )}
        <View style={[styles.compose, { paddingBottom: Math.max(insets.bottom, space.sm), backgroundColor: c.surface, borderColor: c.line }]}>
          <TextInput
            multiline
            accessibilityLabel={t.chat.message}
            placeholder={t.chat.message}
            placeholderTextColor={c.muted}
            maxLength={MAX_MESSAGE}
            value={draft}
            onChangeText={setDraft}
            style={[styles.input, { borderColor: c.line, color: c.fg, backgroundColor: c.bg }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.chat.send}
            accessibilityState={{ disabled: !canSend, busy: sending }}
            disabled={!canSend}
            onPress={() => void send()}
            style={dimWhenPressed([styles.send, { backgroundColor: canSend ? c.brand : c.line }])}
          >
            {sending ? <ActivityIndicator color="#ffffff" /> : <Ionicons name="send" size={18} color="#ffffff" />}
          </Pressable>
        </View>
      </>
    );

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm, backgroundColor: c.surface, borderColor: c.line }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.post.back} hitSlop={8} onPress={goBack} style={dimWhenPressed(styles.back)}>
          <Ionicons name="chevron-back" size={26} color={c.brandDeep} />
        </Pressable>
        {chat && (
          <>
            <View style={[styles.avatar, { backgroundColor: c.brandSoft }]}>
              <Text style={[styles.initial, { color: c.brandDeep }]}>{initials(name)}</Text>
            </View>
            <View style={styles.who}>
              <Text accessibilityRole="header" numberOfLines={1} style={[styles.name, { color: c.fg }]}>
                {name}
              </Text>
              <Pressable accessibilityRole="link" onPress={() => router.push(`/listings/${chat.listingId}`)} style={dimWhenPressed(styles.listing)}>
                <Ionicons name="home-outline" size={13} color={c.brandDeep} />
                <Text numberOfLines={1} style={[styles.listingTitle, { color: c.brandDeep }]}>
                  {chat.listingTitle}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 17, fontWeight: "700" },
  who: { flex: 1, gap: 1 },
  name: { fontSize: 16, fontWeight: "700" },
  listing: { flexDirection: "row", alignItems: "center", gap: 4 },
  listingTitle: { flexShrink: 1, fontSize: 13 },
  thread: { padding: space.lg, gap: space.sm },
  cell: { gap: space.sm },
  day: { alignSelf: "center", fontSize: 12, fontWeight: "600", borderRadius: radius.pill, overflow: "hidden", paddingHorizontal: space.md, paddingVertical: 3, marginVertical: space.sm },
  bubble: { maxWidth: "82%", borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
  mine: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1 },
  text: { fontSize: 15, lineHeight: 21 },
  time: { alignSelf: "flex-end", fontSize: 11 },
  failed: { paddingHorizontal: space.lg, paddingBottom: space.sm, fontSize: 14 },
  compose: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: 22, paddingHorizontal: space.lg, paddingTop: 11, paddingBottom: 11, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
