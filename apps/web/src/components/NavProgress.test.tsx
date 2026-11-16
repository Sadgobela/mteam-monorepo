import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";

const address = vi.hoisted(() => ({ path: "/en", search: "" as string | null }));
vi.mock("next/navigation", () => ({
  usePathname: () => address.path,
  useSearchParams: () => (address.search === null ? null : new URLSearchParams(address.search)),
}));

import { NavProgress, startNavProgress } from "./NavProgress";

const bar = () => document.querySelector(".nav-progress") as HTMLElement;

// Held in variables: these stand for the links Next renders, which the bar must notice.
const home = "/en";
const brokers = `${home}/brokers`;

/** The page with the bar and a few links, at `/en`. */
function page() {
  const view = render(
    <>
      <NavProgress />
      <a href={brokers}>Brokers</a>
      <a href={brokers}>
        <button type="button">Next photo</button>
      </a>
      <a href={`${home}?deal=sale`}>
        <span>Sale</span>
      </a>
      <a href={home}>Here</a>
      <a href="#give">Give</a>
      <a href="tel:+995555000000">Call</a>
      <a href="https://wa.me/995555000000">WhatsApp</a>
      <a href={brokers} target="_blank">
        New tab
      </a>
      <a href={brokers} target="_self">
        Same tab
      </a>
      <a href={`${home}/file.pdf`} download>
        File
      </a>
      <button type="button">Not a link</button>
    </>,
  );
  /** The router arriving at a new address. */
  const arrive = (path: string, search = "") => {
    address.path = path;
    address.search = search;
    view.rerender(
      <>
        <NavProgress />
      </>,
    );
  };
  return { ...view, arrive };
}

const click = (text: string, init: MouseEventInit = {}) => {
  // The innermost element with this text, as a pointer would hit it.
  const target = Array.from(document.querySelectorAll("a, button, span")).reverse().find((element) => element.textContent === text) as HTMLElement;
  // Links would make jsdom try to navigate; the router takes them over in the real page.
  target.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(target, init);
};

beforeEach(() => {
  vi.useFakeTimers();
  address.path = "/en";
  address.search = "";
  window.history.pushState({}, "", "/en");
});
afterEach(() => {
  vi.useRealTimers();
  window.history.pushState({}, "", "/");
});

describe("NavProgress", () => {
  it("is hidden until something starts, and hidden from screen readers", () => {
    page();
    expect(bar()).toHaveAttribute("data-phase", "idle");
    expect(bar()).toHaveAttribute("aria-hidden", "true");
  });

  it("runs from a click on a link to another page until the new page renders, then fades out", () => {
    const { arrive } = page();
    click("Brokers");
    expect(bar()).toHaveAttribute("data-phase", "loading");
    arrive("/en/brokers");
    expect(bar()).toHaveAttribute("data-phase", "done");
    act(() => vi.advanceTimersByTime(400));
    expect(bar()).toHaveAttribute("data-phase", "idle");
  });

  it("counts a change of search as a new page, and a click inside a link as a click on it", () => {
    const { arrive } = page();
    click("Sale");
    expect(bar()).toHaveAttribute("data-phase", "loading");
    arrive("/en", "deal=sale");
    expect(bar()).toHaveAttribute("data-phase", "done");
  });

  it.each([
    ["the page it is on", "Here", {}],
    ["a part of the same page", "Give", {}],
    ["a phone number", "Call", {}],
    ["another site", "WhatsApp", {}],
    ["a new tab", "New tab", {}],
    ["a download", "File", {}],
    ["a link opened with a modifier key", "Brokers", { metaKey: true }],
    ["a link opened with ctrl", "Brokers", { ctrlKey: true }],
    ["a link opened with shift", "Brokers", { shiftKey: true }],
    ["a link opened with alt", "Brokers", { altKey: true }],
    ["a middle click", "Brokers", { button: 1 }],
    ["a click on something else", "Not a link", {}],
    ["a button inside a link", "Next photo", {}],
  ])("stays idle for %s", (_name, text, init) => {
    page();
    click(text, init);
    expect(bar()).toHaveAttribute("data-phase", "idle");
  });

  it("stays idle for a click on the page itself", () => {
    page();
    fireEvent.click(document);
    expect(bar()).toHaveAttribute("data-phase", "idle");
  });

  it("follows a link that names this tab", () => {
    page();
    click("Same tab");
    expect(bar()).toHaveAttribute("data-phase", "loading");
  });

  it("starts for a navigation in code, unless it goes nowhere new", () => {
    page();
    act(() => startNavProgress("/en"));
    expect(bar()).toHaveAttribute("data-phase", "idle");
    act(() => startNavProgress("?deal=rent"));
    expect(bar()).toHaveAttribute("data-phase", "loading");
  });

  it("gives up on a page that never arrives", () => {
    page();
    click("Brokers");
    act(() => vi.advanceTimersByTime(15_000));
    expect(bar()).toHaveAttribute("data-phase", "done");
    act(() => vi.advanceTimersByTime(400));
    expect(bar()).toHaveAttribute("data-phase", "idle");
  });

  it("ignores an address change it did not start, and works without search params", () => {
    address.search = null;
    const { arrive } = page();
    arrive("/en/brokers");
    expect(bar()).toHaveAttribute("data-phase", "idle");
  });

  it("stops listening once gone", () => {
    const { unmount } = page();
    unmount();
    expect(() => act(() => startNavProgress("/en/brokers"))).not.toThrow();
  });
});
