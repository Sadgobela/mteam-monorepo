import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { ChipRow, Button, Field, Heading, Note } from "@/components/ui";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { space, useColors } from "@/lib/theme";

const intents = ["SEEKING", "OWNER", "BROKER"] as const;

/** The first-visit questions, as on the site: a name, what brought them, and the terms, which posting needs. */
export default function OnboardingScreen() {
  const c = useColors();
  const { t } = useLocale();
  const session = useSession();
  const [name, setName] = useState("");
  const [intent, setIntent] = useState<(typeof intents)[number] | undefined>();
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || !intent || !terms) {
      setInvalid(true);
      return;
    }
    setBusy(true);
    try {
      await api.onboard(trimmed, intent);
      await session.refresh();
      router.replace("/account");
    } catch {
      setInvalid(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Heading>{t.profile.welcome}</Heading>
      <Note>{t.profile.welcomeLead}</Note>
      <Field label={t.profile.name} value={name} onChangeText={setName} maxLength={60} />
      <Note>{t.profile.nameHint}</Note>
      <Note>{t.profile.intent}</Note>
      <ChipRow options={intents} value={intent} onChange={setIntent} label={(value) => t.profile.intents[value]} />
      {intent === "BROKER" && <Note>{t.profile.brokerNote}</Note>}
      <View style={styles.terms}>
        <Switch accessibilityLabel={t.profile.terms} value={terms} onValueChange={setTerms} trackColor={{ true: c.brand }} />
        <Text style={[styles.termsText, { color: c.fg }]}>{t.profile.terms}</Text>
      </View>
      {invalid && <Note tone="danger">{t.profile.invalid}</Note>}
      <Button label={t.profile.start} busy={busy} onPress={() => void save()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md },
  terms: { flexDirection: "row", alignItems: "center", gap: space.md },
  termsText: { flex: 1 },
});
