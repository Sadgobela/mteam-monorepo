import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SignInPrompt } from "@/components/SignInPrompt";
import { openTab, useBarSpace } from "@/components/TabBar";
import { Button, Heading, Note, ScreenState } from "@/components/ui";
import { api, type PreferenceKey } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { turnOffPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";
import { useLoad } from "@/lib/use-load";

const notifyKeys = ["notifyMessages", "notifySavedSearches", "notifyPriceDrops", "notifyListingUpdates"] as const;

/** The account's switches and deleting the account, as on the site's settings page. */
export default function SettingsScreen() {
  const session = useSession();
  const { data, state, retry } = useLoad(api.settings);
  if (!session.user) return <SignInPrompt />;
  if (state !== "ready") return <ScreenState state={state} onRetry={retry} />;
  return <SettingsForm preferences={data.preferences} canDelete={data.canDelete} />;
}

function SettingsForm({ preferences, canDelete }: { preferences: Record<PreferenceKey, boolean>; canDelete: boolean }) {
  const c = useColors();
  const { t } = useLocale();
  const s = t.settings;
  const session = useSession();
  const barSpace = useBarSpace();
  const [on, setOn] = useState(preferences);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Flips at once, and back if it could not be saved, as on the site. */
  const flip = (key: PreferenceKey, value: boolean) => {
    setFailed(false);
    setOn((current) => ({ ...current, [key]: value }));
    api.setPreference(key, value).catch(() => {
      setOn((current) => ({ ...current, [key]: !value }));
      setFailed(true);
    });
  };
  const row = (key: PreferenceKey, label: string, hint?: string) => (
    <View key={key} style={styles.row}>
      <View style={styles.grow}>
        <Text style={{ color: c.fg }}>{label}</Text>
        {hint && <Note>{hint}</Note>}
      </View>
      <Switch accessibilityLabel={label} value={on[key]} onValueChange={(value) => flip(key, value)} trackColor={{ true: c.brand }} />
    </View>
  );

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteAccount();
      await turnOffPush();
      await session.signOut();
      openTab("/account");
    } catch {
      setBusy(false);
      Alert.alert(t.feedback.failed);
    }
  };
  const confirmRemove = () =>
    Alert.alert(s.deleteQuestion, undefined, [
      { text: s.deleteNo, style: "cancel" },
      { text: s.deleteYes, style: "destructive", onPress: () => void remove() },
    ]);

  const card = [styles.card, { backgroundColor: c.surface, borderColor: c.line }];
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]}>
      {failed && <Note tone="danger">{s.saveFailed}</Note>}
      <View style={card}>
        <Heading>{s.notificationsHeading}</Heading>
        {notifyKeys.map((key) => row(key, s[key]))}
        {row("notifyPush", t.push.allDevices, t.push.allDevicesHint)}
      </View>
      <View style={card}>
        <Heading>{s.privacyHeading}</Heading>
        {row("hidePhoneDefault", s.hidePhoneDefault, s.hidePhoneHint)}
      </View>
      <View style={card}>
        <Heading>{s.deleteHeading}</Heading>
        {canDelete ? (
          <>
            <Note>{s.deleteIntro}</Note>
            {s.deleteWhat.map((line) => (
              <Note key={line}>{`• ${line}`}</Note>
            ))}
            <Button icon="trash-outline" color={c.danger} label={s.deleteButton} busy={busy} onPress={confirmRemove} />
          </>
        ) : (
          <Note>{s.deleteStaff}</Note>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  grow: { flex: 1, gap: space.xs },
});
