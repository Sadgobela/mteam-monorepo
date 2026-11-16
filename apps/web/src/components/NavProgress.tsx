"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const START = "mteam:navigate";
/** A page that never arrives (an error, a cancelled click) must not leave the bar up for good. */
const GIVE_UP_MS = 15_000;
/** How long the full bar shows before it fades away. */
const DONE_MS = 400;

/** Whether going to `href` means another page of this site has to arrive. */
function changesPage(href: string): boolean {
  const to = new URL(href, location.href);
  return to.origin === location.origin && (to.pathname !== location.pathname || to.search !== location.search);
}

/** Starts the bar for a navigation that is not a link click, such as `router.push(href)`. */
export function startNavProgress(href: string): void {
  if (changesPage(href)) window.dispatchEvent(new Event(START));
}

/** Whether a click opens another page of this site in this tab: not a new tab, a download, a phone number or `#give`. */
function opensPage(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  // The nearest control: a button inside a link (the photo arrows on a card) does not open the link.
  const link = event.target instanceof Element ? event.target.closest("a[href], button") : null;
  if (!(link instanceof HTMLAnchorElement) || (link.target !== "" && link.target !== "_self") || link.hasAttribute("download")) return false;
  return changesPage(link.href);
}

type Phase = "idle" | "loading" | "done";

/** A thin brand-coloured bar at the top that runs from a click until the next page has rendered. */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams()?.toString();
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const start = () => setPhase("loading");
    const click = (event: MouseEvent) => {
      if (opensPage(event)) start();
    };
    // Capture, so the click is seen before the link's own handler takes it over.
    document.addEventListener("click", click, true);
    window.addEventListener(START, start);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener(START, start);
    };
  }, []);

  // A new address means the new page has rendered.
  useEffect(() => setPhase((current) => (current === "loading" ? "done" : current)), [path, search]);

  useEffect(() => {
    if (phase === "idle") return;
    const timer = setTimeout(() => setPhase(phase === "loading" ? "done" : "idle"), phase === "loading" ? GIVE_UP_MS : DONE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return <div className="nav-progress" data-phase={phase} aria-hidden="true" />;
}
