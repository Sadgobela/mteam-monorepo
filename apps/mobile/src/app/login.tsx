import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Button, Field, Heading, Note } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";

type LoginError = "invalidPhone" | "tooSoon" | "wrongCode";

/** Sign-in with a phone code, in the same two steps as the site: the number, then the code from the SMS. */
export default function LoginScreen() {
  const { t } = useLocale();
  const session = useSession();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoginError | "failed" | null>(null);

  const run = async (step: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (failure) {
      const known = failure instanceof ApiError && ["invalidPhone", "tooSoon", "wrongCode"].includes(failure.code);
      setError(known ? (failure.code as LoginError) : "failed");
    } finally {
      setBusy(false);
    }
  };

  const send = () => run(async () => setSentTo((await api.requestCode(phone)).phone));
  const verify = (to: string) =>
    run(async () => {
      const { token, onboarded } = await api.verifyCode(to, code);
      await session.signIn(token);
      router.replace(onboarded ? "/account" : "/onboarding");
    });

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Heading>{t.login.title}</Heading>
      <Note>{t.login.lead}</Note>
      {sentTo === null ? (
        <>
          <Field label={t.login.phone} keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} placeholder="555 12 34 56" />
          <Button label={t.login.send} busy={busy} onPress={() => void send()} />
        </>
      ) : (
        <>
          <Note>{`${t.login.codeSent} ${sentTo}`}</Note>
          <Field label={t.login.code} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" value={code} onChangeText={setCode} />
          <Button label={t.login.verify} busy={busy} onPress={() => void verify(sentTo)} />
          <Button quiet label={t.login.change} onPress={() => setSentTo(null)} />
        </>
      )}
      {error && <Note tone="danger">{error === "failed" ? t.mobile.loadFailed : t.login.errors[error]}</Note>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ page: { padding: space.lg, gap: space.lg } });
