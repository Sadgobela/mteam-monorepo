import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useLocale } from "@/lib/i18n";
import { space } from "@/lib/theme";
import { Button, Note } from "./ui";

/** Opens sign-in, for a heart or anything else a signed-out user presses. */
export const toSignIn = () => router.push("/login");

/** What a signed-out user sees on a screen that needs an account. */
export function SignInPrompt() {
  const { t } = useLocale();
  return (
    <View style={styles.box}>
      <Note>{t.mobile.signInFor}</Note>
      <Button label={t.nav.login} onPress={toSignIn} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { padding: space.xl, gap: space.lg } });
