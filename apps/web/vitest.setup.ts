import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Server-side tests opt into the node environment and have no DOM to set up.
if (typeof window !== "undefined") {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  // jsdom has no matchMedia; default to a light system theme.
  window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
}
