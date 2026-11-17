"use client";

import { useRef, useState, type MouseEvent } from "react";
import { Thumbnail } from "./Thumbnail";

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/** A card's photos: swipe on a phone, arrows under a mouse. The arrows sit inside the card's link, so they stop it. */
export function CardPhotos({ images, alt }: { images: string[]; alt: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);

  function move(event: MouseEvent, direction: number) {
    event.preventDefault();
    const element = strip.current as HTMLDivElement;
    element.scrollBy({ left: direction * element.clientWidth, behavior: "smooth" });
  }

  // Which photo is in view, so the arrow at either end steps aside and a click there opens the listing instead.
  function track() {
    const element = strip.current as HTMLDivElement;
    setAt(Math.round(element.scrollLeft / (element.clientWidth || 1)));
  }

  return (
    <>
      <div ref={strip} className="strip" onScroll={track}>
        {images.map((src, index) => (
          <div key={src} className="strip-photo">
            <Thumbnail src={src} alt={index === 0 ? alt : ""} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        // Hidden from the keyboard and screen readers: every photo is on the listing page, and these are only a shortcut.
        <>
          <button type="button" className="strip-nav previous" data-off={at <= 0 || undefined} aria-hidden="true" tabIndex={-1} onClick={(event) => move(event, -1)}>
            <Chevron back />
          </button>
          <button type="button" className="strip-nav next" data-off={at >= images.length - 1 || undefined} aria-hidden="true" tabIndex={-1} onClick={(event) => move(event, 1)}>
            <Chevron />
          </button>
        </>
      )}
    </>
  );
}
