import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ListingForm } from "@/components/ListingForm";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Button, Note } from "@/components/ui";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";

/** Posting from the phone: the form, once the account is set up, and what happens next once it is sent. */
export default function PostScreen() {
  const { t } = useLocale();
  const session = useSession();
  const [sent, setSent] = useState(false);
  /** Counts the listings sent, so "another" starts from an empty form. */
  const [round, setRound] = useState(0);

  if (!session.user) return <SignInPrompt />;
  if (!session.user.onboarded) {
    return (
      <View style={styles.page}>
        <Note>{t.profile.finish}</Note>
        <Button label={t.profile.start} onPress={() => router.push("/onboarding")} />
      </View>
    );
  }
  if (sent) {
    return (
      <View style={styles.page}>
        <Note>{t.post.sent}</Note>
        <Button label={t.post.toMyListings} onPress={() => router.push("/my-listings")} />
        <Button
          quiet
          label={t.post.another}
          onPress={() => {
            setRound((count) => count + 1);
            setSent(false);
          }}
        />
      </View>
    );
  }
  return <ListingForm key={round} submitLabel={t.post.submit} onSent={() => setSent(true)} />;
}

const styles = StyleSheet.create({ page: { padding: space.lg, gap: space.md } });
