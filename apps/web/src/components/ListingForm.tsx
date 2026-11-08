"use client";

import Image from "next/image";
import { startTransition, useActionState, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
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

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function showPreviews(event: ChangeEvent<HTMLInputElement>) {
    setPreviews(Array.from(event.target.files as FileList).map((file) => URL.createObjectURL(file)));
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
  return (
    <form className="form" onSubmit={submit}>
      <input type="hidden" name="locale" value={locale} />
      <div className="form-row">
        <Choice name="deal" label={t.search.deal} options={dealTypes.map((d) => ({ value: d, label: t.deal[d] }))} />
        <Choice name="type" label={t.search.type} options={propertyTypes.map((p) => ({ value: p, label: t.propertyType[p] }))} />
        <Choice name="city" label={t.search.city} options={citySlugs.map((c) => ({ value: c, label: t.city[c] }))} />
      </div>
      <Input label={f.title} name="title" required maxLength={120} />
      <label className="field">
        <small>{f.description}</small>
        <textarea name="description" required rows={5} maxLength={5000} />
      </label>
      <div className="form-row">
        <Input label={f.district} name="district" required maxLength={100} />
        <Input label={f.address} name="address" required maxLength={200} />
      </div>
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
      <LocationPicker label={f.pin} clearLabel={f.pinClear} />
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
      {error && <p className="note" role="alert">{t.post.errors[error]}</p>}
      <button className="btn" type="submit" disabled={pending}>{t.post.submit}</button>
    </form>
  );
}
