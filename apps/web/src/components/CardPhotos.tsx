"use client";

import { useRef, type MouseEvent } from "react";
import Image from "next/image";

/** A card's photos: swipe on a phone, arrows under a mouse. The arrows sit inside the card's link, so they stop it. */
export function CardPhotos({ images, alt }: { images: string[]; alt: string }) {
  const strip = useRef<HTMLDivElement>(null);

  function move(event: MouseEvent, direction: number) {
    event.preventDefault();
    const element = strip.current as HTMLDivElement;
    element.scrollBy({ left: direction * element.clientWidth, behavior: "smooth" });
  }

  return (
    <>
      <div ref={strip} className="strip">
        {images.map((src) => (
          <div key={src} className="strip-photo">
            <Image src={src} alt={alt} fill unoptimized />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        // Hidden from the keyboard and screen readers: every photo is on the listing page, and these are only a shortcut.
        <>
          <button type="button" className="strip-nav previous" aria-hidden="true" tabIndex={-1} onClick={(event) => move(event, -1)}>
            ‹
          </button>
          <button type="button" className="strip-nav next" aria-hidden="true" tabIndex={-1} onClick={(event) => move(event, 1)}>
            ›
          </button>
        </>
      )}
    </>
  );
}
