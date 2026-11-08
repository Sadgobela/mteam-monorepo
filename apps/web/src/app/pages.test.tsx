import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { searchListings } from "@mteam/db";
import { renderToStaticMarkup } from "react-dom/server";
import { fixtureListings } from "@/test-fixtures";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@mteam/db", async () => {
  const { fixtureListings: listings } = await import("@/test-fixtures");
  return {
    searchListings: vi.fn(async () => listings),
    countActiveListings: async () => 57,
    getListing: async (id: string) => listings.find((l) => String(l.id) === id),
  };
});

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
  it("shows the hero and featured listings", async () => {
    render(await HomePage({ params: p({ locale: "en" }), searchParams: p({}) }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("mTeam picks");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Find a home");
    expect(screen.getAllByRole("link", { name: /m²/ })).toHaveLength(fixtureListings.length);
    expect(screen.getByText("57")).toBeInTheDocument();
  });
});

describe("home page search", () => {
  it("passes the URL filters to the query and reflects them in the form", async () => {
    render(await HomePage({ params: p({ locale: "en" }), searchParams: p({ deal: "rent", rooms: "2", bogus: "x" }) }));
    expect(searchListings).toHaveBeenLastCalledWith({ deal: "rent", rooms: 2 });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Search results");
    expect(screen.getByLabelText("Deal")).toHaveValue("rent");
  });

  it("resets the form when the filters change without a page reload", async () => {
    const { rerender } = render(await HomePage({ params: p({ locale: "en" }), searchParams: p({ deal: "rent" }) }));
    rerender(await HomePage({ params: p({ locale: "en" }), searchParams: p({ deal: "sale" }) }));
    expect(screen.getByLabelText("Deal")).toHaveValue("sale");
  });

  it("treats only invalid filters as an unfiltered home page", async () => {
    render(await HomePage({ params: p({ locale: "en" }), searchParams: p({ type: "projects" }) }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("mTeam picks");
  });

  it("says so when nothing matches", async () => {
    vi.mocked(searchListings).mockResolvedValueOnce([]);
    render(await HomePage({ params: p({ locale: "en" }), searchParams: p({ city: "batumi" }) }));
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
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeInTheDocument();
    expect(screen.getByText(/checked on site/)).toBeInTheDocument();
  });

  it("hides missing details, agent and badge", async () => {
    render(await ListingPage({ params: p({ locale: "en", id: "20422" }) }));
    expect(screen.queryByText("Condition")).toBeNull();
    expect(screen.queryByRole("button", { name: "WhatsApp" })).toBeNull();
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
