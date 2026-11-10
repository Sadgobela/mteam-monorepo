"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
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
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  parseListingDraft,
  propertyTypes,
  type Dict,
  type Locale,
  type PropertyType,
} from "@mteam/shared";
import { z } from "zod";
import { DetailFields } from "./DetailFields";
import { Collapse } from "antd";
import { FormSelect } from "./FormSelect";
import { LocationPicker } from "./LocationPicker";

type StreetsModule = typeof import("@mteam/shared/streets");

const postErrorSchema = z.object({ error: z.enum(["invalid", "photos", "save"]) });
type PostError = z.infer<typeof postErrorSchema>["error"];

function Input({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <small>{label}</small>
      <input {...input} />
    </label>
  );
}

export function ListingForm({ locale, t }: { locale: Locale; t: Dict }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [rejected, setRejected] = useState<PostError | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [city, setCity] = useState(cities[0]);
  const [type, setType] = useState<PropertyType>(propertyTypes[0]);
  const showsRooms = type !== "land" && type !== "commercial";
  const districts = cityDistricts(city);
  const [district, setDistrict] = useState("");
  const [streetsModule, setStreetsModule] = useState<StreetsModule | null>(null);
  const streets = streetsModule?.streetsIn(city, district ? [district] : []) ?? [];

  useEffect(() => {
    void import("@mteam/shared/streets").then(setStreetsModule);
  }, []);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function showPreviews(event: ChangeEvent<HTMLInputElement>) {
    setPreviews(Array.from(event.target.files as FileList).map((file) => URL.createObjectURL(file)));
  }

  function move(event: MouseEvent<HTMLButtonElement>, by: number) {
    const form = event.currentTarget.form as HTMLFormElement;
    const steps = form.querySelectorAll<HTMLFieldSetElement>("fieldset.step");
    const controls = Array.from(steps[step].elements) as HTMLInputElement[];
    setRejected(null);
    if (by > 0 && !controls.every((control) => control.reportValidity())) return;
    // Rules across fields, such as floor against total floors. Checked before the photos, so nobody uploads them first to find out.
    if (by > 0 && step === 1 && !parseListingDraft(Object.fromEntries(new FormData(form)))) {
      setRejected("invalid");
      return;
    }
    // Rendered first so the next step is visible when it takes focus, which also scrolls it into view.
    flushSync(() => setStep(step + by));
    steps[step + by].focus();
  }

  // Sent by hand so that a rejected listing does not clear the form.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    // Checked here because a set over the server's size limit would be refused before any friendly error could be returned.
    const files = data.getAll("photos").filter((value): value is File => value instanceof File);
    if (files.length > MAX_PHOTOS || files.some((file) => file.size > MAX_PHOTO_BYTES)) {
      setRejected("photos");
      return;
    }

    setRejected(null);
    setPending(true);
    try {
      const response = await fetch("/api/listings", { method: "POST", body: data });
      // These two leave the form busy on purpose: the page is changing, and a second press would post the listing twice.
      if (response.ok) return router.push(`/${locale}/listings/new?sent=1`);
      if (response.status === 401) return router.push(`/${locale}/login`);
      setRejected(postErrorSchema.parse(await response.json()).error);
    } catch {
      setRejected("save");
    }
    setPending(false);
  }

  const f = t.post.fields;
  const stepNames = [t.post.steps.place, t.post.steps.details, t.post.steps.photos];
  const last = stepNames.length - 1;
  // Every step stays in the form so its values are sent and survive going back.
  const stepProps = (index: number) => ({
    className: index === step ? "step" : "step off",
    "aria-label": stepNames[index],
    tabIndex: -1,
  });
  return (
    <form className="form" onSubmit={submit}>
      <ol className="stepper">
        {stepNames.map((name, index) => (
          <li key={name} aria-current={index === step ? "step" : undefined}>
            <b>{index + 1}</b> <span>{name}</span>
          </li>
        ))}
      </ol>
      <div className="steps">
        <fieldset {...stepProps(0)}>
          <div className="form-row">
            <FormSelect name="deal" label={t.search.deal} initial={dealTypes[0]} options={dealTypes.map((d) => ({ value: d, label: t.deal[d] }))} />
            <FormSelect name="type" label={t.search.type} initial={type} options={propertyTypes.map((p) => ({ value: p, label: t.propertyType[p] }))} onChange={(value) => setType(value as PropertyType)} />
            <FormSelect
              name="city"
              label={t.search.city}
              initial={cities[0]}
              options={cities.map((name) => ({ value: name, label: placeLabel(name, locale) }))}
              onChange={(value) => {
                setCity(value);
                setDistrict("");
              }}
            />
          </div>
          <div className="form-row">
            {districts.length > 0 && (
              <FormSelect key={city} name="district" label={f.district} options={districts.map((name) => ({ value: name, label: placeLabel(name, locale) }))} onChange={setDistrict} />
            )}
            {streets.length > 0 && (
              <FormSelect key={`${city}/${district}`} name="street" optional label={f.street} options={streets.map((name) => ({ value: name, label: placeLabel(name, locale) }))} />
            )}
            <Input label={f.address} name="address" required maxLength={200} pattern=".*\S.*" />
            {city === METRO_CITY && (
              <FormSelect name="metro" optional label={t.search.metro} options={metroStations.map((name) => ({ value: name, label: placeLabel(name, locale) }))} />
            )}
          </div>
          <LocationPicker label={f.pin} clearLabel={f.pinClear} />
        </fieldset>
        <fieldset {...stepProps(1)}>
          {type !== "land" && <FormSelect name="building" optional label={t.search.status} options={buildingStatuses.map((status) => ({ value: status, label: t.search.building[status] }))} />}
          <div className="form-row">
            <Input label={f.price} name="price" type="number" required min={1} max={2000000000} />
            <FormSelect name="currency" label={f.currency} initial={currencies[0]} options={currencies.map((c) => ({ value: c, label: c }))} />
            <Input label={f.area} name="area" type="number" required min={0.01} step={0.01} />
          </div>
          <div className="form-row">
            {showsRooms && <Input label={f.rooms} name="rooms" type="number" min={1} max={50} required={type !== "hotel"} />}
            {type !== "land" && <Input label={f.floor} name="floor" type="number" min={1} max={200} />}
            {type !== "land" && <Input label={f.floors} name="floors" type="number" min={1} max={200} />}
          </div>
          <Input label={f.title} name="title" required maxLength={120} />
          <label className="field">
            <small>{f.description}</small>
            <textarea name="description" required rows={5} maxLength={5000} />
          </label>
          {type !== "land" && <Collapse items={[{ key: "details", label: f.moreDetails, forceRender: true, children: <DetailFields locale={locale} t={t} showsRooms={showsRooms} /> }]} />}
        </fieldset>
        <fieldset {...stepProps(2)}>
          <Input label={f.photos} name="photos" type="file" required multiple accept="image/jpeg,image/png,image/webp" onChange={showPreviews} />
          {previews.length > 0 && (
            <div className="previews">
              {previews.map((url) => (
                <div key={url} className="ph thumb">
                  <Image src={url} alt="" fill unoptimized />
                </div>
              ))}
            </div>
          )}
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
          <button key="submit" className="btn" type="submit" disabled={pending}>{t.post.submit}</button>
        )}
      </div>
    </form>
  );
}
