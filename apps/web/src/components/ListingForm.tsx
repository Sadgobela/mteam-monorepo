"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import {
  buildingStatuses,
  cities,
  metroStations,
  METRO_CITY,
  cityDistricts,
  placeLabel,
  currencies,
  dealTypes,
  parseDraftProgress,
  parseListingDraft,
  propertyTypes,
  type Dict,
  type Locale,
  type PropertyType,
} from "@mteam/shared";
import type { EditableListing } from "@mteam/db";
import { z } from "zod";
import { Checkbox, Collapse } from "antd";
import { DetailFields } from "./DetailFields";
import { FormSelect } from "./FormSelect";
import { ListingPhotos, type PhotoItem } from "./ListingPhotos";
import { ListingPreview, QualityMeter } from "./ListingPreview";
import { PriceHint } from "./PriceHint";
import { LocationPicker } from "./LocationPicker";
import { SubmitButton } from "./SubmitButton";
import { loginPath } from "@/lib/login-path";
import { writeDescriptionAction, type WriteResult } from "@/lib/post-actions";
import { shrinkPhoto } from "@/lib/shrink-photo";

import "@/app/post.css";

/** Above what the server keeps (2048 px), so its own resize decides the final size. */
const LISTING_PHOTO_EDGE = 2560;

type StreetsModule = typeof import("@mteam/shared/streets");

const postErrorSchema = z.object({ error: z.enum(["invalid", "photos", "save", "missing", "tooMany"]) });
type PostError = z.infer<typeof postErrorSchema>["error"];
const savedSchema = z.object({ id: z.number(), status: z.enum(["DRAFT", "PENDING", "ACTIVE"]) });
const uploadedSchema = z.object({ url: z.string() });

/** A request the server turned down, with the reason the form shows. */
class Refused extends Error {
  constructor(readonly reason: PostError | "signedOut") {
    super(reason);
  }
}

async function send(path: string, body: FormData): Promise<unknown> {
  const response = await fetch(path, { method: "POST", body });
  if (response.status === 401) throw new Refused("signedOut");
  const reply: unknown = await response.json();
  if (!response.ok) throw new Refused(postErrorSchema.safeParse(reply).data?.error ?? "save");
  return reply;
}

/** The form's text values by name. It holds no files: photos travel separately. */
const valuesOf = (form: HTMLFormElement): Record<string, string> =>
  Object.fromEntries(Array.from(new FormData(form)).filter((entry): entry is [string, string] => typeof entry[1] === "string"));

/** `short` for a number that shares a row with another on a phone; every other field takes the whole row there. */
function Input({ label, short = false, ...input }: { label: string; short?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={short ? "field short" : "field"}>
      <small>{label}</small>
      <input {...input} />
    </label>
  );
}

const PLACE = 0;
const DETAILS = 1;
const PRICE = 2;

/**
 * Posts a new listing, or edits one when `initial` is given: the same form, filled in. A preview card and a quality meter follow
 * what is typed. A new listing or a draft is saved as a DRAFT at each step change, so it can be finished later from my listings.
 */
export function ListingForm({
  locale,
  t,
  gelPerUsd,
  initial,
  hidePhoneDefault = false,
  ai = false,
}: {
  locale: Locale;
  t: Dict;
  /** The stored lari rate, for comparing a price in lari with the market. */
  gelPerUsd: number;
  initial?: EditableListing;
  hidePhoneDefault?: boolean;
  /** Offers to write the description with AI, which needs the AI key on the server. */
  ai?: boolean;
}) {
  const router = useRouter();
  const values = initial?.fields ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [rejected, setRejected] = useState<PostError | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>(() => (initial?.images ?? []).map((url) => ({ url, preview: url })));
  const [step, setStep] = useState(0);
  const [city, setCity] = useState(values.city || cities[0]);
  const [type, setType] = useState<PropertyType>((values.type as PropertyType | undefined) || propertyTypes[0]);
  const showsRooms = type !== "land" && type !== "commercial";
  const districts = cityDistricts(city);
  const [district, setDistrict] = useState(values.district ?? "");
  const [streetsModule, setStreetsModule] = useState<StreetsModule | null>(null);
  const streets = streetsModule?.streetsIn(city, district ? [district] : []) ?? [];
  // Asked for before a district is chosen in a city that has districts; elsewhere it is just empty.
  const streetHint = districts.length > 0 && !district ? t.ui.streetHint : undefined;
  // The street saved with the listing applies only while its own city and district are chosen.
  const street = city === values.city && district === values.district ? values.street : "";
  const here = initial ? `/${locale}/listings/${initial.id}/edit` : `/${locale}/listings/new`;
  const isDraft = !initial || initial.status === "DRAFT";
  // The draft this form autosaves into, once there is one. Saves run one after another, so two never start two drafts.
  const draftId = useRef(initial?.status === "DRAFT" ? initial.id : null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  // Each chosen photo's address once it is uploaded, by its preview, so no save uploads it twice.
  const uploaded = useRef(new Map<string, string>());
  const [writing, setWriting] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  // What the preview and the meter show. Read from the form after each change has rendered, as Ant's selects set their value then.
  const [snapshot, setSnapshot] = useState<Record<string, string>>({});
  const [changes, setChanges] = useState(0);
  const changed = () => setChanges((count) => count + 1);
  useEffect(() => setSnapshot(valuesOf(formRef.current as HTMLFormElement)), [changes]);

  useEffect(() => {
    void import("@mteam/shared/streets").then(setStreetsModule);
  }, []);

  /** Uploads the photos chosen here, one per request, and returns every photo's address in order. */
  async function uploadPhotos(items: PhotoItem[]): Promise<string[]> {
    const urls: string[] = [];
    for (const item of items) {
      if ("url" in item) {
        urls.push(item.url);
        continue;
      }
      const known = uploaded.current.get(item.preview);
      if (known) {
        urls.push(known);
        continue;
      }
      const body = new FormData();
      body.set("photo", await shrinkPhoto(item.file, LISTING_PHOTO_EDGE), item.file.name);
      const { url } = uploadedSchema.parse(await send("/api/listings/photos", body));
      urls.push(url);
      // Remembered at once, as a save queued earlier still holds the photos from before this upload.
      uploaded.current.set(item.preview, url);
      setPhotos((list) => list.map((other) => (other.preview === item.preview ? { url, preview: item.preview } : other)));
    }
    return urls;
  }

  /** Saves the form as it is now into the draft, after any save still running. Quietly does nothing until deal, type and city are valid. */
  function autosave(form: HTMLFormElement) {
    const data = new FormData(form);
    if (!isDraft || !parseDraftProgress(valuesOf(form))) return;
    const items = photos;
    saving.current = saving.current.then(async () => {
      try {
        const urls = await uploadPhotos(items);
        data.set("intent", "draft");
        if (draftId.current !== null) data.set("id", String(draftId.current));
        for (const url of urls) data.append("photos", url);
        draftId.current = savedSchema.parse(await send("/api/listings", data)).id;
      } catch {
        // Tried again at the next step; sending the listing reports anything that keeps failing.
      }
    });
  }

  function move(event: MouseEvent<HTMLButtonElement>, by: number) {
    const form = event.currentTarget.form as HTMLFormElement;
    const steps = form.querySelectorAll<HTMLFieldSetElement>("fieldset.step");
    const controls = Array.from(steps[step].elements) as HTMLInputElement[];
    setRejected(null);
    if (by > 0 && !controls.every((control) => control.reportValidity())) return;
    // Rules across fields, such as floor against total floors, before the photos so nobody uploads them first to find out.
    // The price comes a step after the details, so a stand-in fills it while the details are checked.
    const fields = valuesOf(form);
    if (by > 0 && (step === DETAILS || step === PRICE) && !parseListingDraft({ ...fields, price: fields.price || "1" })) {
      setRejected("invalid");
      return;
    }
    autosave(form);
    // Rendered first so the next step is visible when it takes focus, which also scrolls it into view.
    flushSync(() => setStep(step + by));
    steps[step + by].focus();
  }

  /** Fills the three descriptions with what AI wrote from the form's facts. The owner reads and edits them before sending. */
  async function writeDescriptions(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form as HTMLFormElement;
    setWriting(true);
    setAiNote(null);
    const result: WriteResult = await writeDescriptionAction(valuesOf(form)).catch(() => ({ error: "failed" }));
    setWriting(false);
    if ("error" in result) return setAiNote(t.post.ai.errors[result.error]);
    const { ka, en, ru } = result.descriptions;
    for (const [name, text] of [["description", ka], ["descriptionEn", en], ["descriptionRu", ru]]) (form.elements.namedItem(name) as HTMLTextAreaElement).value = text;
    setAiNote(t.post.ai.check);
    changed();
  }

  // Sent by hand so that a rejected listing does not clear the form.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (photos.length === 0) {
      setRejected("photos");
      return;
    }
    setRejected(null);
    setPending(true);
    try {
      await saving.current;
      const urls = await uploadPhotos(photos);
      data.set("intent", "submit");
      const id = initial?.id ?? draftId.current;
      if (id !== null) data.set("id", String(id));
      for (const url of urls) data.append("photos", url);
      savedSchema.parse(await send("/api/listings", data));
      // This leaves the form busy on purpose: the page is changing, and a second press would post the listing twice.
      return router.push(isDraft ? `/${locale}/listings/new?sent=1` : `${here}?saved=1`);
    } catch (error) {
      const reason = error instanceof Refused ? error.reason : "save";
      // Nothing was posted, and sign-in opens over this form, which must work again once it is closed.
      if (reason === "signedOut") {
        setPending(false);
        return router.push(loginPath(locale, here));
      }
      setRejected(reason);
    }
    setPending(false);
  }

  const f = t.post.fields;
  const stepNames = [t.post.steps.place, t.post.steps.details, t.post.steps.price, t.post.steps.photos, t.post.steps.contact];
  const last = stepNames.length - 1;
  // Every step stays in the form so its values are sent and survive going back.
  const stepProps = (index: number) => ({
    className: index === step ? "step" : "step off",
    "aria-label": stepNames[index],
    tabIndex: -1,
  });
  return (
    <div className="post-layout">
      <form ref={formRef} className="form" onSubmit={submit} onChange={changed}>
        <ol className="stepper">
          {stepNames.map((name, index) => (
            <li key={name} aria-current={index === step ? "step" : undefined}>
              <b>{index + 1}</b> <span>{name}</span>
            </li>
          ))}
        </ol>
        <div className="steps">
          <fieldset {...stepProps(PLACE)}>
            {/* A fixed grid: every field keeps its place while the form is filled. District and street are always there, disabled until they apply. */}
            <div className="post-grid">
              <FormSelect name="deal" label={t.search.deal} initial={values.deal || dealTypes[0]} options={dealTypes.map((d) => ({ value: d, label: t.deal[d] }))} onChange={changed} />
              <FormSelect
                name="type"
                label={t.search.type}
                initial={type}
                options={propertyTypes.map((p) => ({ value: p, label: t.propertyType[p] }))}
                onChange={(value) => {
                  setType(value as PropertyType);
                  changed();
                }}
              />
              <FormSelect
                name="city"
                label={t.search.city}
                initial={city}
                options={cities.map((name) => ({ value: name, label: placeLabel(name, locale) }))}
                onChange={(value) => {
                  setCity(value);
                  setDistrict("");
                  changed();
                }}
              />
              <FormSelect
                key={city}
                name="district"
                label={f.district}
                initial={district}
                disabled={districts.length === 0}
                options={districts.map((name) => ({ value: name, label: placeLabel(name, locale) }))}
                onChange={(value) => {
                  setDistrict(value);
                  changed();
                }}
              />
              <FormSelect
                key={`${city}/${district}`}
                name="street"
                optional
                label={f.street}
                initial={street}
                disabled={streets.length === 0}
                hint={streetHint}
                options={streets.map((name) => ({ value: name, label: placeLabel(name, locale) }))}
              />
              {city === METRO_CITY && (
                <FormSelect name="metro" optional label={t.search.metro} initial={values.metro} options={metroStations.map((name) => ({ value: name, label: placeLabel(name, locale) }))} />
              )}
              <div className="wide">
                <Input label={f.address} name="address" required maxLength={200} pattern=".*\S.*" defaultValue={values.address} />
              </div>
            </div>
            <LocationPicker label={f.pin} clearLabel={f.pinClear} initial={values.lat && values.lng ? { lat: values.lat, lng: values.lng } : null} />
            <div className="post-grid">
              <Input label={f.cadastralCode} name="cadastralCode" maxLength={40} pattern="\s*\d+(\.\d+)*\s*" inputMode="decimal" defaultValue={values.cadastralCode} />
            </div>
          </fieldset>
          <fieldset {...stepProps(DETAILS)}>
            <div className="post-grid">
              {type !== "land" && (
                <FormSelect name="building" optional label={t.search.status} initial={values.building} options={buildingStatuses.map((status) => ({ value: status, label: t.search.building[status] }))} onChange={changed} />
              )}
              <Input short label={f.area} name="area" type="number" required min={0.01} step={0.01} defaultValue={values.area} />
              {showsRooms && <Input short label={f.rooms} name="rooms" type="number" min={1} max={50} required={type !== "hotel"} defaultValue={values.rooms} />}
              {type !== "land" && <Input short label={f.floor} name="floor" type="number" min={1} max={200} defaultValue={values.floor} />}
              {type !== "land" && <Input short label={f.floors} name="floors" type="number" min={1} max={200} defaultValue={values.floors} />}
            </div>
            <Input label={f.title} name="title" required maxLength={120} defaultValue={values.title} />
            <label className="field">
              <small>{f.description}</small>
              <textarea name="description" required rows={5} maxLength={5000} defaultValue={values.description} />
            </label>
            <label className="field">
              <small>{f.descriptionEn}</small>
              <textarea name="descriptionEn" rows={3} maxLength={5000} defaultValue={values.descriptionEn} />
            </label>
            <label className="field">
              <small>{f.descriptionRu}</small>
              <textarea name="descriptionRu" rows={3} maxLength={5000} defaultValue={values.descriptionRu} />
            </label>
            {ai && (
              <>
                <button type="button" className="btn ghost ai-write" disabled={writing} aria-busy={writing} onClick={writeDescriptions}>
                  {writing ? t.post.ai.writing : t.post.ai.write}
                </button>
                {aiNote && (
                  <p className="meta" role="status">
                    {aiNote}
                  </p>
                )}
              </>
            )}
            {type !== "land" && (
              <Collapse items={[{ key: "details", label: f.moreDetails, forceRender: true, children: <DetailFields locale={locale} t={t} showsRooms={showsRooms} values={values} onChange={changed} /> }]} />
            )}
          </fieldset>
          <fieldset {...stepProps(PRICE)}>
            <div className="post-grid">
              <Input short label={f.price} name="price" type="number" required min={1} max={2000000000} defaultValue={values.price} />
              <FormSelect className="field short" name="currency" label={f.currency} initial={values.currency || currencies[0]} options={currencies.map((c) => ({ value: c, label: c }))} onChange={changed} />
            </div>
            <PriceHint values={snapshot} gelPerUsd={gelPerUsd} t={t} />
          </fieldset>
          <fieldset {...stepProps(3)}>
            <ListingPhotos items={photos} onChange={setPhotos} onTooMany={() => setRejected("photos")} t={t} />
          </fieldset>
          <fieldset {...stepProps(4)}>
            <Checkbox name="hidePhone" defaultChecked={initial ? values.hidePhone === "on" : hidePhoneDefault}>
              {f.hidePhone}
            </Checkbox>
            <p className="meta">{t.post.phoneNotice}</p>
          </fieldset>
        </div>
        {rejected && <p className="note" role="alert">{t.post.errors[rejected]}</p>}
        <div className="step-nav">
          {step > 0 && (
            <button key="back" type="button" className="btn ghost" onClick={(event) => move(event, -1)}>{t.post.back}</button>
          )}
          {/* Separate keys: if React reused one element, the click that reaches the last step would also submit the form. */}
          {step < last ? (
            <button key="next" type="button" className="btn" onClick={(event) => move(event, 1)}>{t.post.next}</button>
          ) : (
            <SubmitButton key="submit" pending={pending}>{isDraft ? t.post.submit : t.post.save}</SubmitButton>
          )}
        </div>
      </form>
      {/* Beside the form on a wide screen, where it cannot be folded; below it on a phone, where it can. */}
      <details className="post-aside" open>
        <summary>{t.post.preview}</summary>
        <div className="post-aside-body">
          <ListingPreview values={snapshot} photo={photos[0]?.preview} locale={locale} t={t} />
          <QualityMeter values={snapshot} photos={photos.length} t={t} />
        </div>
      </details>
    </div>
  );
}
