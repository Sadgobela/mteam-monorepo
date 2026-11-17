import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { MAX_MESSAGE } from "@mteam/shared";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";
import { toSignIn } from "./SignInPrompt";
import { Button, Field, Note } from "./ui";

/**
 * "Write" on a listing, as on the site: it opens a box for the first message, and sending it starts the chat and opens
 * it. A signed-out user is sent to sign in first.
 */
export function WriteToSeller({ listingId }: { listingId: number }) {
  const c = useColors();
  const { t } = useLocale();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!open) return <Button quiet icon="chatbubble-ellipses-outline" label={t.ui.write} onPress={() => (session.user ? setOpen(true) : toSignIn())} />;

  const send = async () => {
    setBusy(true);
    try {
      const { id } = await api.startChat(listingId, draft.trim());
      setOpen(false);
      setDraft("");
      setFailed(false);
      router.push(`/messages/${id}`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Field label={t.chat.write} autoFocus multiline maxLength={MAX_MESSAGE} value={draft} onChangeText={setDraft} style={styles.input} />
      {failed && <Note tone="danger">{t.chat.failed}</Note>}
      <Button icon="send" label={t.chat.send} busy={busy} disabled={!draft.trim()} onPress={() => void send()} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md, padding: space.md, borderWidth: 1, borderRadius: radius.lg },
  input: { minHeight: 96, paddingTop: space.md, textAlignVertical: "top" },
});
