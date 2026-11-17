import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { cityDistricts, currencies, MAX_PHOTOS, parseListingDraft, placeLabel, popularCities, propertyTypes } from "@mteam/shared";
import { useBarSpace } from "@/components/TabBar";
import { Button, ChipRow, Field, Heading, Note } from "@/components/ui";
import { api, ApiError, type ListingStatus, type PickedPhoto } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { radius, space, useColors } from "@/lib/theme";

const deals = ["sale", "rent", "daily"] as const;
type FormError = "invalid" | "photos" | "tooMany" | "save" | "access";
const knownErrors = new Set(["invalid", "photos", "tooMany"]);
const blank = { deal: "sale", type: "apartment", city: "", district: "", address: "", title: "", description: "", price: "", currency: "USD", area: "", rooms: "", floor: "", floors: "" };

/** A photo picked from the gallery, still to upload, or the address of one the listing already has. */
type FormPhoto = PickedPhoto | string;
const photoUri = (photo: FormPhoto) => (typeof photo === "string" ? photo : photo.uri);

/** One of the user's listings to edit: its id, every field by name, and its photos. */
export type ListingToEdit = { id: number; fields: Record<string, string>; images: string[] };

/**
 * The posting form: the fields every listing needs, and photos from the gallery. The rest of the details can be added
 * on the site; an edit keeps those it has, as every field the listing came with is sent back. The same checks as the
 * site run before anything is sent, and the server checks again. `onSent` gets the status the listing now has.
 */
export function ListingForm({ initial, submitLabel, onSent }: { initial?: ListingToEdit; submitLabel: string; onSent: (status: ListingStatus) => void }) {
  const c = useColors();
  const barSpace = useBarSpace();
  const { locale, t } = useLocale();
  const [fields, setFields] = useState<Record<string, string>>(initial ? { ...blank, ...initial.fields } : blank);
  const [photos, setPhotos] = useState<FormPhoto[]>(initial?.images ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  // A new city clears the district, and either clears the street, which the site picks from the district's.
  const set = (name: string) => (value: string | undefined) =>
    setFields((current) => ({ ...current, [name]: value ?? "", ...(name === "city" ? { district: "", street: "" } : name === "district" ? { street: "" } : {}) }));
  const districts = fields.city ? cityDistricts(fields.city) : [];
  // A listing from the site may be in a city the short list leaves out: it is shown first, so its chip stays chosen.
  const cities = fields.city && !popularCities.includes(fields.city) ? [fields.city, ...popularCities] : popularCities;

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
      for (const photo of photos) urls.push(typeof photo === "string" ? photo : (await api.uploadPhoto(photo)).url);
      const saved = await api.submitListing(initial ? { ...filled, id: String(initial.id) } : filled, urls);
      onSent(saved.status);
    } catch (failure) {
      setError(failure instanceof ApiError && knownErrors.has(failure.code) ? (failure.code as FormError) : "save");
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]} keyboardShouldPersistTaps="handled">
      <Heading>{t.post.steps.place}</Heading>
      <ChipRow options={deals} value={fields.deal as (typeof deals)[number]} onChange={set("deal")} label={(deal) => t.deal[deal]} />
      <ChipRow options={propertyTypes} value={fields.type as (typeof propertyTypes)[number]} onChange={set("type")} label={(type) => t.propertyType[type]} />
      <ChipRow options={cities} value={fields.city || undefined} onChange={set("city")} label={(city) => placeLabel(city, locale)} />
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
          <Pressable
            key={photoUri(photo)}
            accessibilityRole="button"
            accessibilityLabel={`${t.post.fields.photoRemove} ${index + 1}`}
            onPress={() => setPhotos((current) => current.filter((other) => other !== photo))}
          >
            <Image source={{ uri: photoUri(photo) }} style={[styles.photo, { borderColor: c.line }]} />
          </Pressable>
        ))}
      </View>
      {photos.length < MAX_PHOTOS && <Button quiet label={t.mobile.addPhoto} onPress={() => void pick()} />}

      <Note>{t.post.phoneNotice}</Note>
      {busy && <Note>{t.mobile.uploading}</Note>}
      {error && <Note tone="danger">{error === "access" ? t.mobile.photoAccess : t.post.errors[error]}</Note>}
      <Button label={submitLabel} busy={busy} onPress={() => void submit()} />
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
