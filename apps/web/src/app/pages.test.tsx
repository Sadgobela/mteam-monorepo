import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { countListings, searchListings } from "@mteam/db";
import { renderToStaticMarkup } from "react-dom/server";
import { fixtureListings } from "@/test-fixtures";

vi.mock("next/navigation", () => ({
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
vi.mock("@/lib/account-actions", () => ({ toggleFavoriteAction: vi.fn() }));
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));

vi.mock("leaflet", () => ({
  default: {
    map: () => {
      const map = { setView: () => map, fitBounds: () => map, remove: () => undefined, on: () => undefined };
      return map;
    },
    tileLayer: () => ({ addTo: () => undefined }),
    circleMarker: () => ({ bindPopup: () => ({ addTo: () => undefined }), addTo: () => undefined }),
    latLngBounds: (points: unknown) => points,
  },
}));

import LocaleLayout, { generateStaticParams, metadata } from "./[locale]/layout";
import HomePage, { dynamic as homeRendering } from "./[locale]/page";
import ListingPage, { dynamic as listingRendering } from "./[locale]/listings/[id]/page";

const p = <T,>(v: T) => Promise.resolve(v);

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
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Verified by mTeam");
    expect(screen.getAllByRole("link", { name: /m²/ })).toHaveLength(fixtureListings.length);
    expect(screen.getByRole("link", { name: /Give it to mTeam/ })).toHaveAttribute("href", "#give");
    expect(screen.getByRole("heading", { level: 2, name: /Give it to mTeam/ })).toBeInTheDocument();
    expect(screen.queryByText(/Listings found/)).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });

  it("treats only invalid filters as the home page", async () => {
    await home({ type: "projects" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Verified by mTeam");
  });

  it("passes filters and display options to the query and reflects them", async () => {
    await home({ deal: "rent", rooms: "2", sort: "asc", page: "2", bogus: "x" });
    expect(searchListings).toHaveBeenLastCalledWith(expect.objectContaining({ deal: "rent", rooms: 2 }), { sort: "asc", page: 2 });
    expect(countListings).toHaveBeenLastCalledWith(expect.objectContaining({ deal: "rent", rooms: 2 }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Search results");
    expect(screen.getByText("Listings found: 57")).toBeInTheDocument();
    expect(screen.getByLabelText("Deal")).toHaveValue("rent");
  });

  it("shows results for a submitted form with every filter empty", async () => {
    await home({ deal: "" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Search results");
  });

  it("keeps filters in sort, view and currency links, and marks the active ones", async () => {
    await home({ deal: "sale", sort: "desc", view: "list", cur: "gel" });
    expect(screen.getByRole("link", { name: "Price ↑" })).toHaveAttribute("href", "/en?deal=sale&sort=asc&view=list&cur=gel&page=1");
    expect(screen.getByRole("link", { name: "Newest" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Price ↓" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Grid" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "₾" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "$" })).toHaveAttribute("href", "/en?deal=sale&sort=desc&view=list&cur=usd");
  });

  it("uses the list layout only when asked", async () => {
    const list = await home({ deal: "sale", view: "list" });
    expect(list.container.querySelector(".cards.list")).not.toBeNull();
    list.unmount();
    const grid = await home({ deal: "sale" });
    expect(grid.container.querySelector(".cards.list")).toBeNull();
    expect(screen.getByRole("link", { name: "Newest" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Price ↑" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Price ↓" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "$" })).toHaveAttribute("aria-current", "true");
  });

  it("shows a map instead of cards, without paging, using only located listings", async () => {
    vi.mocked(searchListings).mockResolvedValueOnce([
      { ...fixtureListings[0], lat: 41.7, lng: 44.7 },
      { ...fixtureListings[1], lat: 41.7 },
      { ...fixtureListings[2], lng: 44.7 },
    ]);
    await home({ deal: "sale", view: "map", sort: "asc" });
    expect(searchListings).toHaveBeenLastCalledWith(expect.anything(), { sort: "asc", limit: 200 });
    expect(screen.getByRole("region", { name: "Map" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /m²/ })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "true");
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
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Verified by mTeam");
  });

  it("has no pager when everything fits on one page", async () => {
    vi.mocked(countListings).mockResolvedValueOnce(3);
    await home({ deal: "sale" });
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });

  it("resets the form when the filters change without a page reload", async () => {
    const { rerender } = render(await HomePage({ params: p({ locale: "en" }), searchParams: p({ deal: "rent" }) }));
    rerender(await HomePage({ params: p({ locale: "en" }), searchParams: p({ deal: "sale" }) }));
    expect(screen.getByLabelText("Deal")).toHaveValue("sale");
  });

  it("says so when nothing matches", async () => {
    vi.mocked(searchListings).mockResolvedValueOnce([]);
    await home({ city: "batumi" });
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
    render(await ListingPage({ params: p({ locale: "en", id: "20418" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ვაკეში");
    expect(screen.getByText("Floor")).toBeInTheDocument();
    expect(screen.getByText("Condition")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+995555000000");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/995555000000");
    expect(screen.getByText(/mTeam broker/)).toBeInTheDocument();
    expect(screen.getByText(/checked on site/)).toBeInTheDocument();
  });

  it("hides missing details, agent and badge", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20422" }) }));
    expect(screen.queryByText("Condition")).toBeNull();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.queryByText(/mTeam broker/)).toBeNull();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByText(/checked on site/)).toBeNull();
  });

  it("hides the floor when it is unknown", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20440" }) }));
    expect(screen.queryByText("Floor")).toBeNull();
  });

  it("shows 404 for an unknown listing", async () => {
    await expect(ListingPage({ params: p({ locale: "en", id: "1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
