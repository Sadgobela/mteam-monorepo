import { useCallback } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ListingForm } from "@/components/ListingForm";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Button, Note, ScreenState } from "@/components/ui";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";
import { useLoad } from "@/lib/use-load";

/**
 * One of the user's listings in the posting form, filled in, as on the site's edit page; a draft opened from my listings
 * lands here too, to finish it. Once saved it says what happens next and goes back.
 */
export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const session = useSession();
  const { data, state, retry } = useLoad(useCallback(() => api.editableListing(id), [id]));
  if (!session.user) return <SignInPrompt />;
  if (!session.user.onboarded) {
    return (
      <View style={styles.page}>
        <Note>{t.profile.finish}</Note>
        <Button label={t.profile.start} onPress={() => router.push("/onboarding")} />
      </View>
    );
  }
  if (state !== "ready") return <ScreenState state={state} onRetry={retry} />;
  const draft = data.status === "DRAFT";
  return (
    <>
      <Stack.Screen options={{ title: draft ? t.post.heading : t.post.editHeading }} />
      <ListingForm
        initial={data}
        submitLabel={draft ? t.post.submit : t.post.save}
        onSent={(status) => {
          // A draft sent now goes to review for the first time; an edit is either live again or back in review.
          Alert.alert(status === "ACTIVE" ? t.post.savedLive : draft ? t.post.sent : t.post.savedReview);
          if (router.canGoBack()) router.back();
          else router.replace("/my-listings");
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({ page: { padding: space.lg, gap: space.md } });
