import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { languageNames, locales } from "@mteam/shared";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useBarSpace } from "@/components/TabBar";
import { Button, ChipRow, Heading, Menu, MenuRow, Note } from "@/components/ui";
import { fill, useLocale } from "@/lib/i18n";
import { pushIsOn, turnOffPush, turnOnPush, type PushResult } from "@/lib/push";
import { useSession } from "@/lib/session";
import { space, useColors } from "@/lib/theme";

/**
 * The account tab: the language for everyone; for a signed-in user also a menu of their listings, chats and saved
 * searches, push on this phone and signing out.
 */
export default function AccountScreen() {
  const c = useColors();
  const barSpace = useBarSpace();
  const { locale, t, setLocale } = useLocale();
  const session = useSession();
  const [push, setPush] = useState(false);
  const [pushNote, setPushNote] = useState<Exclude<PushResult, "on"> | "failed" | null>(null);
  const [busy, setBusy] = useState(false);
  const user = session.user;

  useEffect(() => {
    if (user) void pushIsOn().then(setPush);
  }, [user]);

  const switchPush = async (on: boolean) => {
    setPushNote(null);
    if (!on) {
      await turnOffPush();
      setPush(false);
      return;
    }
    const result = await turnOnPush(locale).catch(() => "failed" as const);
    setPush(result === "on");
    if (result !== "on") setPushNote(result);
  };

  const signOut = async () => {
    setBusy(true);
    await turnOffPush();
    await session.signOut();
    setPush(false);
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]}>
      {user ? (
        <>
          <Heading>{user.name ? fill(t.mobile.welcome, { name: user.name }) : t.account.heading}</Heading>
          {user.phone && <Note>{user.phone}</Note>}
          {!user.onboarded && <Button label={t.profile.finish} onPress={() => router.push("/onboarding")} />}
          <Menu>
            <MenuRow icon="list-outline" label={t.my.heading} onPress={() => router.push("/my-listings")} />
            <MenuRow icon="chatbubbles-outline" label={t.mobile.messages} onPress={() => router.push("/messages")} />
            <MenuRow icon="bookmark-outline" label={t.saved.heading} onPress={() => router.push("/saved-searches")} />
          </Menu>
          <View style={styles.row}>
            <View style={styles.grow}>
              <Text style={{ color: c.fg }}>{t.mobile.pushOn}</Text>
              <Note>{t.mobile.pushHint}</Note>
            </View>
            <Switch accessibilityLabel={t.mobile.pushOn} value={push} onValueChange={(on) => void switchPush(on)} trackColor={{ true: c.brand }} />
          </View>
          {pushNote && <Note tone="danger">{{ blocked: t.mobile.pushBlocked, unavailable: t.mobile.pushUnavailable, failed: t.push.failed }[pushNote]}</Note>}
        </>
      ) : (
        session.ready && <SignInPrompt nested />
      )}
      <Note>{t.mobile.appLanguage}</Note>
      <ChipRow options={locales} value={locale} onChange={(next) => next && setLocale(next)} label={(value) => languageNames[value]} />
      {user && <Button quiet busy={busy} label={t.nav.logout} onPress={() => void signOut()} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  grow: { flex: 1, gap: space.xs },
});
