import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { countListings, searchListings } from "@mteam/db";
import { renderToStaticMarkup } from "react-dom/server";
import { fixtureListings } from "@/test-fixtures";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

vi.mock("@mteam/db", async () => {
  const { fixtureListings: listings } = await import("@/test-fixtures");
  return {
    searchListings: vi.fn(async () => listings),
    countListings: vi.fn(async () => 57),
    PAGE_SIZE: 24,
    getListing: async (id: string) => listings.find((l) => String(l.id) === id),
  };
});

vi.mock("@/lib/session", () => ({ hasSession: async () => false, currentUser: async () => null }));
vi.mock("@/lib/account-actions", () => ({ setFavoriteAction: vi.fn() }));
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));

const circleMarker = vi.hoisted(() => vi.fn(() => ({ bindPopup: () => ({ addTo: () => undefined }), addTo: () => undefined })));

vi.mock("leaflet", () => ({
  default: {
    map: () => {
      const map = { setView: () => map, fitBounds: () => map, remove: () => undefined, on: () => undefined };
      return map;
    },
    tileLayer: () => ({ addTo: () => undefined }),
    circleMarker: circleMarker,
    latLngBounds: (points: unknown) => points,
  },
}));

import LocaleLayout, { generateStaticParams, metadata } from "./[locale]/layout";
import HomePage, { dynamic as homeRendering } from "./[locale]/page";
import ListingPage, { dynamic as listingRendering } from "./[locale]/listings/[id]/page";

const p = <T,>(v: T) => Promise.resolve(v);
const radio = (name: string) => screen.getByRole("radio", { name });

describe("layout", () => {
  it("builds one page per language", () => {
    expect(generateStaticParams()).toEqual([{ locale: "ka" }, { locale: "en" }, { locale: "ru" }]);
    expect(metadata.title).toContain("MTeam");
  });

  it("sets the document language", async () => {
    const html = renderToStaticMarkup(await LocaleLayout({ children: <p>hi</p>, params: p({ locale: "ru" }) }));
    expect(html).toContain('<html lang="ru"');
    expect(html).toContain("mteam-theme");
  });
});

describe("home page", () => {
  const home = async (query: Record<string, string> = {}, locale = "en") =>
    render(await HomePage({ params: p({ locale }), searchParams: p(query) }));

  it("shows verified listings and the main entry points", async () => {
    await home();
    expect(searchListings).toHaveBeenLastCalledWith({ verified: true }, { limit: 4 });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Verified by MTeam");
    expect(screen.getAllByRole("link", { name: /m²/ })).toHaveLength(fixtureListings.length);
    expect(screen.getByRole("link", { name: /Give it to MTeam/ })).toHaveAttribute("href", "#give");
    expect(screen.getByRole("heading", { level: 2, name: /Give it to MTeam/ })).toBeInTheDocument();
    expect(screen.queryByText(/Listings found/)).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });

  it("treats only invalid filters as the home page", async () => {
    await home({ type: "projects" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Verified by MTeam");
  });

  it("passes filters and display options to the query and reflects them", async () => {
    await home({ deal: "rent", rooms: "2", sort: "asc", page: "2", bogus: "x" });
    expect(searchListings).toHaveBeenLastCalledWith(expect.objectContaining({ deal: "rent", rooms: 2 }), { sort: "asc", page: 2 });
    expect(countListings).toHaveBeenLastCalledWith(expect.objectContaining({ deal: "rent", rooms: 2 }), { located: false });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Search results");
    expect(screen.getByText("Listings found: 57")).toBeInTheDocument();
    expect(screen.getByRole("search")).toHaveTextContent("For rent");
  });

  it("shows results for a submitted form with every filter empty", async () => {
    await home({ deal: "" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Search results");
  });

  it("keeps filters in sort, view and currency links, and marks the active ones", async () => {
    await home({ deal: "sale", sort: "desc", view: "list", cur: "gel" });
    expect(radio("Newest")).not.toBeChecked();
    expect(radio("Price ↓")).toBeChecked();
    expect(radio("Grid")).not.toBeChecked();
    expect(radio("List")).toBeChecked();
    expect(radio("₾")).toBeChecked();
    fireEvent.click(radio("Price ↑"));
    await waitFor(() => expect(push).toHaveBeenLastCalledWith("/en?deal=sale&sort=asc&view=list&cur=gel&page=1", { scroll: false }));
    fireEvent.click(radio("$"));
    await waitFor(() => expect(push).toHaveBeenLastCalledWith("/en?deal=sale&sort=desc&view=list&cur=usd", { scroll: false }));
  });

  it("uses the list layout only when asked", async () => {
    const list = await home({ deal: "sale", view: "list" });
    expect(list.container.querySelector(".cards.list")).not.toBeNull();
    list.unmount();
    const grid = await home({ deal: "sale" });
    expect(grid.container.querySelector(".cards.list")).toBeNull();
    expect(radio("Newest")).toBeChecked();
    expect(radio("Price ↑")).not.toBeChecked();
    expect(radio("Price ↓")).not.toBeChecked();
    expect(radio("$")).toBeChecked();
  });

  it("shows a map instead of cards, without paging, using only located listings", async () => {
    vi.mocked(searchListings).mockResolvedValueOnce([
      { ...fixtureListings[0], lat: 41.7, lng: 44.7 },
      { ...fixtureListings[1], lat: 41.7 },
      { ...fixtureListings[2], lng: 44.7 },
    ]);
    circleMarker.mockClear();
    await home({ deal: "sale", view: "map", sort: "asc" });
    expect(searchListings).toHaveBeenLastCalledWith(expect.anything(), { sort: "asc", limit: 200, located: true });
    expect(countListings).toHaveBeenLastCalledWith(expect.anything(), { located: true });
    await waitFor(() => expect(circleMarker).toHaveBeenCalledOnce());
    expect(circleMarker.mock.calls[0]).toEqual([[41.7, 44.7], expect.anything()]);
    expect(screen.getByRole("region", { name: "Map" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /m²/ })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
    expect(radio("Map")).toBeChecked();
  });

  it("does not redirect a stale page number on the map", async () => {
    await home({ deal: "sale", view: "map", page: "50" });
    expect(screen.getByRole("region", { name: "Map" })).toBeInTheDocument();
  });

  it("does not use a saved view on the home page", async () => {
    const { container } = await home({ view: "list" });
    expect(container.querySelector(".cards.list")).toBeNull();
  });

  it("links to the next page only when more results exist", async () => {
    await home({ deal: "sale" });
    expect(screen.getByRole("link", { name: "Next →" })).toHaveAttribute("href", "/en?deal=sale&page=2");
    expect(screen.queryByRole("link", { name: "← Previous" })).toBeNull();
  });

  it("links back from a later page and stops at the end", async () => {
    await home({ deal: "sale", page: "3" });
    expect(screen.getByRole("link", { name: "← Previous" })).toHaveAttribute("href", "/en?deal=sale&page=2");
    expect(screen.queryByRole("link", { name: "Next →" })).toBeNull();
  });

  it("sends a link past the end to the last page", async () => {
    await expect(HomePage({ params: p({ locale: "en" }), searchParams: p({ deal: "sale", page: "50" }) })).rejects.toThrow(
      "REDIRECT /en?deal=sale&page=3",
    );
  });

  it("does not redirect when there are no results at all", async () => {
    vi.mocked(countListings).mockResolvedValueOnce(0);
    vi.mocked(searchListings).mockResolvedValueOnce([]);
    await home({ deal: "sale" });
    expect(screen.getByText("No listings match these filters.")).toBeInTheDocument();
  });

  it("treats a repeated deal as no search, because its links could not keep it", async () => {
    render(await HomePage({ params: p({ locale: "en" }), searchParams: p({ deal: ["a", "b"] }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Verified by MTeam");
  });

  it("has no pager when everything fits on one page", async () => {
    vi.mocked(countListings).mockResolvedValueOnce(3);
    await home({ deal: "sale" });
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });

  it("resets the form when the filters change without a page reload", async () => {
    const { rerender } = render(await HomePage({ params: p({ locale: "en" }), searchParams: p({ deal: "rent" }) }));
    rerender(await HomePage({ params: p({ locale: "en" }), searchParams: p({ deal: "sale" }) }));
    expect(screen.getByRole("search")).toHaveTextContent("For sale");
  });

  it("says so when nothing matches", async () => {
    vi.mocked(searchListings).mockResolvedValueOnce([]);
    await home({ city: "ბათუმი" });
    expect(screen.getByText("No listings match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /m²/ })).toBeNull();
  });
});

describe("rendering", () => {
  it("renders database pages per request, so the build needs no database", () => {
    expect([homeRendering, listingRendering]).toEqual(["force-dynamic", "force-dynamic"]);
  });
});

describe("listing page", () => {
  it("shows a full listing with agent and verification", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20418" }), searchParams: p({}) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ვაკეში");
    expect(screen.getByText("Floor")).toBeInTheDocument();
    expect(screen.getByText("Condition")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+995555000000");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/995555000000");
    expect(screen.getByText(/MTeam broker/)).toBeInTheDocument();
    expect(screen.getByText(/checked on site/)).toBeInTheDocument();
  });

  it("hides missing details, agent and badge", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20422" }), searchParams: p({}) }));
    expect(screen.queryByText("Condition")).toBeNull();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.queryByText(/MTeam broker/)).toBeNull();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByText(/checked on site/)).toBeNull();
  });

  it("hides the floor when it is unknown", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20440" }), searchParams: p({}) }));
    expect(screen.queryByText("Floor")).toBeNull();
  });

  it("shows the price with a currency switch in the contact box", async () => {
    const view = await ListingPage({ params: p({ locale: "en", id: "20418" }), searchParams: p({}) });
    render(view);
    expect(screen.getByText("$148,000")).toBeInTheDocument();
    expect(screen.getByText("$1,609 / m²")).toBeInTheDocument();
    expect(radio("$")).toBeChecked();
    fireEvent.click(radio("₾"));
    await waitFor(() => expect(push).toHaveBeenLastCalledWith("/en/listings/20418?cur=gel", { scroll: false }));
  });

  it("converts the price when ₾ is chosen", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20418" }), searchParams: p({ cur: "gel" }) }));
    expect(screen.getByText("₾399,600")).toBeInTheDocument();
    expect(radio("₾")).toBeChecked();
  });

  it("keeps the posted price visible when it was converted", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20440" }), searchParams: p({}) }));
    expect(screen.getByText("Listed at: ₾270,000")).toBeInTheDocument();
  });

  it("does not repeat the price when it needed no conversion", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20418" }), searchParams: p({}) }));
    expect(screen.queryByText(/Listed at/)).toBeNull();
  });

  it("shows a rental per month and without a price per m²", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20422" }), searchParams: p({}) }));
    expect(screen.getByText("/ month")).toBeInTheDocument();
    expect(screen.queryByText(/\/ m²/)).toBeNull();
  });

  it("offers owners Give it to MTeam", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20418" }), searchParams: p({}) }));
    expect(screen.getByRole("heading", { name: /Give it to MTeam/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave your number" })).toBeInTheDocument();
  });

  it("draws an icon beside each fact", async () => {
    const { container } = render(await ListingPage({ params: p({ locale: "en", id: "20418" }), searchParams: p({}) }));
    expect(container.querySelectorAll(".facts dt svg")).toHaveLength(4);
  });

  it("shows 404 for an unknown listing", async () => {
    await expect(ListingPage({ params: p({ locale: "en", id: "1" }), searchParams: p({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
