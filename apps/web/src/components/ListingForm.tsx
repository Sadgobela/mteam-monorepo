"use client";

import Image from "next/image";
import { startTransition, useActionState, useEffect, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import {
  citySlugs,
  currencies,
  dealTypes,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  propertyTypes,
  type Dict,
  type Locale,
} from "@mteam/shared";
import { createListingAction } from "@/lib/listing-actions";
import { LocationPicker } from "./LocationPicker";

function Choice({ name, label, options }: { name: string; label: string; options: { value: string; label: string }[] }) {
  return (
    <label className="field">
      <small>{label}</small>
      <select name={name} required>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Input({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <small>{label}</small>
      <input {...input} />
    </label>
  );
}

export function ListingForm({ locale, t }: { locale: Locale; t: Dict }) {
  const [state, dispatch, pending] = useActionState(createListingAction, {});
  const [photosRejected, setPhotosRejected] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState(0);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function showPreviews(event: ChangeEvent<HTMLInputElement>) {
    setPreviews(Array.from(event.target.files as FileList).map((file) => URL.createObjectURL(file)));
  }

  function move(event: MouseEvent<HTMLButtonElement>, by: number) {
    const steps = (event.currentTarget.form as HTMLFormElement).querySelectorAll("fieldset");
    const controls = Array.from(steps[step].elements) as HTMLInputElement[];
    if (by > 0 && !controls.every((control) => control.reportValidity())) return;
    // Rendered first so the next step is visible when it takes focus, which also scrolls it into view.
    flushSync(() => setStep(step + by));
    steps[step + by].focus();
  }

  // Dispatching by hand stops React from clearing the form, so a server-side error does not lose what was typed.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    // Checked here because a set over the server's body limit would fail before any friendly error could be returned.
    const files = data.getAll("photos").filter((value): value is File => value instanceof File);
    const acceptable = files.length <= MAX_PHOTOS && files.every((file) => file.size <= MAX_PHOTO_BYTES);
    setPhotosRejected(!acceptable);
    if (!acceptable) return;

    startTransition(() => dispatch(data));
  }

  const f = t.post.fields;
  const error = photosRejected ? "photos" : state.error;
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
      <input type="hidden" name="locale" value={locale} />
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
            <Choice name="deal" label={t.search.deal} options={dealTypes.map((d) => ({ value: d, label: t.deal[d] }))} />
            <Choice name="type" label={t.search.type} options={propertyTypes.map((p) => ({ value: p, label: t.propertyType[p] }))} />
            <Choice name="city" label={t.search.city} options={citySlugs.map((c) => ({ value: c, label: t.city[c] }))} />
          </div>
          <div className="form-row">
            <Input label={f.district} name="district" required maxLength={100} />
            <Input label={f.address} name="address" required maxLength={200} />
          </div>
          <LocationPicker label={f.pin} clearLabel={f.pinClear} />
        </fieldset>
        <fieldset {...stepProps(1)}>
          <div className="form-row">
            <Input label={f.price} name="price" type="number" required min={1} max={2000000000} />
            <Choice name="currency" label={f.currency} options={currencies.map((c) => ({ value: c, label: c }))} />
            <Input label={f.area} name="area" type="number" required min={0.01} step={0.01} />
          </div>
          <div className="form-row">
            <Input label={f.rooms} name="rooms" type="number" min={1} max={50} />
            <Input label={f.floor} name="floor" type="number" min={1} max={200} />
            <Input label={f.floors} name="floors" type="number" min={1} max={200} />
          </div>
          <Input label={f.title} name="title" required maxLength={120} />
          <label className="field">
            <small>{f.description}</small>
            <textarea name="description" required rows={5} maxLength={5000} />
          </label>
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
      {error && <p className="note" role="alert">{t.post.errors[error]}</p>}
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
