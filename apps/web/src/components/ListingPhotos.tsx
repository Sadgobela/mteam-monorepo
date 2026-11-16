"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { MAX_PHOTOS, type Dict } from "@mteam/shared";
import { Thumbnail } from "./Thumbnail";

/** A photo already stored (its address), or one chosen here and not uploaded yet. `preview` is what the page shows and the key. */
export type PhotoItem = { preview: string } & ({ url: string } | { file: File });

const isLocal = (item: PhotoItem) => "file" in item;

/** The listing's photos in display order, the first being the main one: add, move earlier or later, remove. */
export function ListingPhotos({ items, onChange, onTooMany, t }: { items: PhotoItem[]; onChange: (items: PhotoItem[]) => void; onTooMany: () => void; t: Dict }) {
  const f = t.post.fields;
  const current = useRef(items);
  current.current = items;
  // Previews of chosen files hold memory until released; the ones still shown are released when the form goes away.
  useEffect(() => () => current.current.filter(isLocal).forEach((item) => URL.revokeObjectURL(item.preview)), []);

  function add(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files as FileList);
    // Cleared so choosing the same file again still counts as a change.
    event.target.value = "";
    const room = MAX_PHOTOS - items.length;
    if (files.length > room) onTooMany();
    onChange([...items, ...files.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }

  function move(index: number, by: number) {
    const next = [...items];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  }

  function remove(index: number) {
    if (isLocal(items[index])) URL.revokeObjectURL(items[index].preview);
    onChange(items.filter((_, other) => other !== index));
  }

  return (
    <div className="field">
      <label className="field">
        <small>{f.photos}</small>
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={add} />
      </label>
      {items.length > 0 && (
        <ol className="photo-list">
          {items.map((item, index) => (
            <li key={item.preview}>
              <div className="ph thumb">
                <Thumbnail src={item.preview} alt="" />
                {index === 0 && <span className="photo-cover">{f.cover}</span>}
              </div>
              <div className="photo-tools">
                <button type="button" className="btn ghost" aria-label={`${f.photoEarlier} ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>
                  ←
                </button>
                <button type="button" className="btn ghost" aria-label={`${f.photoLater} ${index + 1}`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                  →
                </button>
                <button type="button" className="btn ghost" aria-label={`${f.photoRemove} ${index + 1}`} onClick={() => remove(index)}>
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
