import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { sampleListings } from "@mteam/shared";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import LocaleLayout, { generateStaticParams, metadata } from "./[locale]/layout";
import HomePage from "./[locale]/page";
import ListingPage from "./[locale]/listings/[id]/page";

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
    render(await HomePage({ params: p({ locale: "en" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Find a home");
    expect(screen.getAllByRole("link", { name: /m²/ })).toHaveLength(sampleListings.length);
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
