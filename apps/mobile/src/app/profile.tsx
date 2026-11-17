import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Avatar } from "@/components/People";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useBarSpace } from "@/components/TabBar";
import { Button, ChipRow, Field, Note, ScreenState } from "@/components/ui";
import { api, ApiError, type Intent, type Profile } from "@/lib/api";
import { fill, useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { useLoad } from "@/lib/use-load";

const intents = ["SEEKING", "OWNER", "BROKER"] as const;

/** The user's name, photo and what brings them here, as on the site's profile page. */
export default function ProfileScreen() {
  const session = useSession();
  const { data, state, retry } = useLoad(api.profile);
  if (!session.user) return <SignInPrompt />;
  if (state !== "ready") return <ScreenState state={state} onRetry={retry} />;
  return <ProfileForm profile={data} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { locale, t } = useLocale();
  const session = useSession();
  const barSpace = useBarSpace();
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [name, setName] = useState(profile.name ?? "");
  const [intent, setIntent] = useState<Intent | undefined>(profile.intent ?? undefined);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "muted" | "danger" } | null>(null);
  // Georgia only, so dates read the same for everyone, as on the site.
  const joined = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Asia/Tbilisi" }).format(new Date(profile.createdAt));

  const changePhoto = async () => {
    setNote(null);
    if (!(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted) {
      setNote({ text: t.mobile.photoAccess, tone: "danger" });
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (picked.canceled) return;
    setPhotoBusy(true);
    try {
      setAvatarUrl((await api.uploadAvatar(picked.assets[0])).avatarUrl);
    } catch (error) {
      setNote({ text: error instanceof ApiError && error.code === "tooMany" ? t.profile.photoTooMany : t.profile.photoFailed, tone: "danger" });
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    // What brings them here is asked for, as on the site; the server checks the rest.
    if (!intent) {
      setNote({ text: t.profile.invalid, tone: "danger" });
      return;
    }
    setNote(null);
    setBusy(true);
    try {
      await api.saveProfile(name.trim(), intent);
      setNote({ text: t.profile.saved, tone: "muted" });
      // The greeting on the account tab uses the name.
      void session.refresh();
    } catch (error) {
      setNote({ text: error instanceof ApiError && error.code === "invalid" ? t.profile.invalid : t.feedback.failed, tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={styles.photo}>
        <Avatar name={name || "?"} url={avatarUrl} size={96} />
        <Note>{fill(t.profile.joined, { date: joined })}</Note>
        <Button quiet icon="camera-outline" label={avatarUrl ? t.profile.photoChange : t.profile.photo} busy={photoBusy} onPress={() => void changePhoto()} />
      </View>
      <Field label={t.profile.name} value={name} onChangeText={setName} maxLength={60} autoComplete="name" />
      <Note>{t.profile.nameHint}</Note>
      <Note>{t.profile.intent}</Note>
      <ChipRow options={intents} value={intent} onChange={(next) => next && setIntent(next)} label={(option) => t.profile.intents[option]} />
      {note && <Note tone={note.tone}>{note.text}</Note>}
      <Button label={t.profile.save} busy={busy} onPress={() => void save()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ page: { padding: space.lg, gap: space.md }, photo: { alignItems: "center", gap: space.sm } });
