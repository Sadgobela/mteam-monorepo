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

  // jsdom prints an error for pseudo-element styles, which Ant Design asks for when it measures a scrollbar.
  const getComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (element) => getComputedStyle(element);

  // jsdom has no layout, so nothing ever resizes.
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // jsdom has no matchMedia; default to a light system theme.
  window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
}
