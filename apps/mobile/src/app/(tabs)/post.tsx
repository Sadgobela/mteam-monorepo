import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { cityDistricts, currencies, MAX_PHOTOS, parseListingDraft, placeLabel, popularCities, propertyTypes } from "@mteam/shared";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useBarSpace } from "@/components/TabBar";
import { Button, ChipRow, Field, Heading, Note } from "@/components/ui";
import { api, ApiError, type PickedPhoto } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { radius, space, useColors } from "@/lib/theme";

const deals = ["sale", "rent", "daily"] as const;
type PostError = "invalid" | "photos" | "tooMany" | "save" | "access";
const knownErrors = new Set(["invalid", "photos", "tooMany"]);
const empty = { deal: "sale", type: "apartment", city: "", district: "", address: "", title: "", description: "", price: "", currency: "USD", area: "", rooms: "", floor: "", floors: "" };

/**
 * Posting from the phone: the fields every listing needs, and photos from the gallery. The rest of the details can be
 * added later on the site. The same checks as the site run before anything is sent, and the server checks again.
 */
export default function PostScreen() {
  const c = useColors();
  const barSpace = useBarSpace();
  const { locale, t } = useLocale();
  const session = useSession();
  const [fields, setFields] = useState<Record<string, string>>(empty);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PostError | null>(null);
  const [sent, setSent] = useState(false);

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
            setFields(empty);
            setPhotos([]);
            setSent(false);
          }}
        />
      </View>
    );
  }

  const set = (name: string) => (value: string | undefined) => setFields((current) => ({ ...current, [name]: value ?? "", ...(name === "city" ? { district: "" } : {}) }));
  const districts = fields.city ? cityDistricts(fields.city) : [];

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("access");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length, quality: 0.8 });
    if (!picked.canceled) setPhotos((current) => [...current, ...picked.assets].slice(0, MAX_PHOTOS));
  };

  const submit = async () => {
    setError(null);
    const filled = Object.fromEntries(Object.entries(fields).filter(([, value]) => value.trim() !== ""));
    if (!parseListingDraft(filled)) {
      setError("invalid");
      return;
    }
    if (photos.length === 0) {
      setError("photos");
      return;
    }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const photo of photos) urls.push((await api.uploadPhoto(photo)).url);
      await api.submitListing(filled, urls);
      setSent(true);
    } catch (failure) {
      setError(failure instanceof ApiError && knownErrors.has(failure.code) ? (failure.code as PostError) : "save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]} keyboardShouldPersistTaps="handled">
      <Heading>{t.post.steps.place}</Heading>
      <ChipRow options={deals} value={fields.deal as (typeof deals)[number]} onChange={set("deal")} label={(deal) => t.deal[deal]} />
      <ChipRow options={propertyTypes} value={fields.type as (typeof propertyTypes)[number]} onChange={set("type")} label={(type) => t.propertyType[type]} />
      <ChipRow options={popularCities} value={fields.city || undefined} onChange={set("city")} label={(city) => placeLabel(city, locale)} />
      {districts.length > 0 && <ChipRow options={districts} value={fields.district || undefined} onChange={set("district")} label={(district) => placeLabel(district, locale)} />}
      <Field label={t.post.fields.address} value={fields.address} onChangeText={set("address")} />

      <Heading>{t.post.steps.details}</Heading>
      <Field label={t.post.fields.title} value={fields.title} onChangeText={set("title")} maxLength={120} />
      <Field label={t.post.fields.description} value={fields.description} onChangeText={set("description")} multiline style={styles.multiline} />
      <View style={styles.row}>
        <View style={styles.third}>
          <Field label={t.post.fields.area} keyboardType="decimal-pad" value={fields.area} onChangeText={set("area")} />
        </View>
        <View style={styles.third}>
          <Field label={t.post.fields.rooms} keyboardType="number-pad" value={fields.rooms} onChangeText={set("rooms")} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.third}>
          <Field label={t.post.fields.floor} keyboardType="number-pad" value={fields.floor} onChangeText={set("floor")} />
        </View>
        <View style={styles.third}>
          <Field label={t.post.fields.floors} keyboardType="number-pad" value={fields.floors} onChangeText={set("floors")} />
        </View>
      </View>

      <Heading>{t.post.steps.price}</Heading>
      <Field label={t.post.fields.price} keyboardType="number-pad" value={fields.price} onChangeText={set("price")} />
      <ChipRow options={currencies} value={fields.currency as (typeof currencies)[number]} onChange={set("currency")} label={(currency) => currency} />

      <Heading>{t.post.steps.photos}</Heading>
      <Note>{t.post.fields.photos}</Note>
      <View style={styles.photos}>
        {photos.map((photo, index) => (
          <Pressable key={photo.uri} accessibilityRole="button" accessibilityLabel={`${t.post.fields.photoRemove} ${index + 1}`} onPress={() => setPhotos((current) => current.filter((other) => other !== photo))}>
            <Image source={{ uri: photo.uri }} style={[styles.photo, { borderColor: c.line }]} />
          </Pressable>
        ))}
      </View>
      {photos.length < MAX_PHOTOS && <Button quiet label={t.mobile.addPhoto} onPress={() => void pick()} />}

      <Note>{t.post.phoneNotice}</Note>
      {busy && <Note>{t.mobile.uploading}</Note>}
      {error && <Note tone="danger">{error === "access" ? t.mobile.photoAccess : t.post.errors[error]}</Note>}
      <Button label={t.post.submit} busy={busy} onPress={() => void submit()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md },
  row: { flexDirection: "row", gap: space.md },
  third: { flex: 1 },
  multiline: { minHeight: 120, textAlignVertical: "top", paddingTop: space.md },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  photo: { width: 96, height: 96, borderRadius: radius.sm, borderWidth: 1 },
});
