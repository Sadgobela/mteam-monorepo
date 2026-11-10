"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import type { Dict, Listing } from "@mteam/shared";

const SWIPE_PIXELS = 40;

/** The layout has clean shapes for 1, 2, 3 and 5 tiles. Four would leave a hole. */
const tileCount = (total: number) => (total === 4 ? 3 : Math.min(total, 5));

export function Gallery({ images, title, tone, t }: { images: string[]; title: string; tone: Listing["tone"]; t: Dict }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef(0);
  const [current, setCurrent] = useState<number | null>(null);
  const total = images.length;

  if (total === 0) {
    return (
      <div className="gal" data-tiles="3">
        <div className={`ph ${tone}`} />
        <div className="ph sand" />
        <div className="ph steel" />
      </div>
    );
  }

  function open(index: number) {
    setCurrent(index);
    (dialog.current as HTMLDialogElement).showModal();
  }

  function move(by: number) {
    setCurrent((index) => ((index as number) + by + total) % total);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowRight") move(1);
    if (event.key === "ArrowLeft") move(-1);
  }

  function onTouchEnd(event: TouchEvent) {
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > SWIPE_PIXELS) move(distance < 0 ? 1 : -1);
  }

  const tiles = images.slice(0, tileCount(total));
  return (
    <>
      <div className="gal" data-tiles={tiles.length}>
        {tiles.map((url, index) => (
          <button key={url} type="button" className="ph" onClick={() => open(index)}>
            <Image src={url} alt={`${title} ${index + 1}`} fill unoptimized priority={index === 0} />
            {index === 0 && total > 1 && (
              <span className="count">
                {total} {t.card.photos}
              </span>
            )}
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="viewer"
        aria-label={title}
        onClose={() => setCurrent(null)}
        onKeyDown={onKeyDown}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0].clientX;
        }}
        onTouchEnd={onTouchEnd}
      >
        {current !== null && (
          <>
            <div className="viewer-photo">
              <Image src={images[current]} alt={`${title} ${current + 1}`} fill unoptimized />
            </div>
            <button type="button" className="btn ghost viewer-close" onClick={() => (dialog.current as HTMLDialogElement).close()}>
              {t.gallery.close}
            </button>
            {total > 1 && (
              <>
                <button type="button" className="viewer-nav previous" aria-label={t.gallery.previous} onClick={() => move(-1)}>
                  ‹
                </button>
                <button type="button" className="viewer-nav next" aria-label={t.gallery.next} onClick={() => move(1)}>
                  ›
                </button>
                <span className="count">
                  {current + 1} / {total}
                </span>
                <div className="viewer-thumbs">
                  {images.map((url, index) => (
                    <button key={url} type="button" aria-label={`${title} ${index + 1}`} aria-current={index === current ? "true" : undefined} onClick={() => setCurrent(index)}>
                      <Image src={url} alt="" fill unoptimized />
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
