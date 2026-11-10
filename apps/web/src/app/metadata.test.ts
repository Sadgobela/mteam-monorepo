import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureListings } from "@/test-fixtures";

const db = vi.hoisted(() => ({ countListings: vi.fn(), getListing: vi.fn(), priceStats: vi.fn(), sitemapListings: vi.fn(), sitemapSearches: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => ({}));
vi.mock("@/lib/auth-actions", () => ({}));
vi.mock("@/lib/account-actions", () => ({}));
vi.mock("@/lib/report-actions", () => ({}));
vi.mock("@/lib/lead-actions", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn(), useRouter: vi.fn() }));

import { generateMetadata as brokersMetadata } from "./[locale]/brokers/page";
import { generateMetadata as layoutMetadata } from "./[locale]/layout";
import { generateMetadata as listingMetadata } from "./[locale]/listings/[id]/page";
import { generateMetadata as homeMetadata } from "./[locale]/page";
import { generateMetadata as pricesMetadata } from "./[locale]/prices/page";
import { register } from "../instrumentation";
import robots from "./robots";
import sitemap from "./sitemap";

const locale = (value: string) => Promise.resolve({ locale: value });
const query = (value: Record<string, string>) => Promise.resolve(value);
const [listing] = fixtureListings;

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("page metadata", () => {
  it("gives the site its name in the page language", async () => {
    vi.stubEnv("SITE_URL", "https://example.test");
    const metadata = await layoutMetadata({ params: locale("en") });
    expect(metadata.title).toEqual({ default: "MTeam: real estate", template: "%s | MTeam" });
    expect(metadata.metadataBase?.href).toBe("https://example.test/");
  });

  it("uses the local address during development, also when the setting is blank", async () => {
    expect((await layoutMetadata({ params: locale("en") })).metadataBase?.href).toBe("http://localhost:3111/");
    vi.stubEnv("SITE_URL", "");
    expect((await layoutMetadata({ params: locale("en") })).metadataBase?.href).toBe("http://localhost:3111/");
  });

  it("stops the server starting on a missing or broken address", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "");
    expect(() => register()).toThrow();
    for (const broken of ["mteam.example", "localhost:3111", "javascript:alert(1)"]) {
      vi.stubEnv("SITE_URL", broken);
      expect(() => register()).toThrow();
    }
    vi.stubEnv("SITE_URL", "https://example.test/");
    expect(() => register()).not.toThrow();
  });

  it("leaves the home page's title to the site and points at itself", async () => {
    const metadata = await homeMetadata({ params: locale("en"), searchParams: query({}) });
    expect(metadata.title).toBeUndefined();
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toBe("/en");
  });

  it("keeps a search with no results out of the index", async () => {
    db.countListings.mockResolvedValue(0);
    const metadata = await homeMetadata({ params: locale("en"), searchParams: query({ deal: "sale", type: "hotel" }) });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("names and indexes a search by deal, type and city", async () => {
    db.countListings.mockResolvedValue(3);
    const metadata = await homeMetadata({ params: locale("en"), searchParams: query({ deal: "sale", type: "apartment", city: "თბილისი" }) });
    expect(metadata.title).toBe("For sale · Apartment · Tbilisi | MTeam");
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toBe(`/en?${new URLSearchParams({ deal: "sale", type: "apartment", city: "თბილისი" })}`);
    expect(metadata.alternates?.languages).toHaveProperty("ka", `/ka?${new URLSearchParams({ deal: "sale", type: "apartment", city: "თბილისი" })}`);
  });

  it("keeps sorted, paged and finely filtered results out of the index", async () => {
    const metadata = await homeMetadata({ params: locale("en"), searchParams: query({ deal: "sale", page: "2" }) });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("/en?deal=sale");
  });

  it("describes a listing with its first photo", async () => {
    db.getListing.mockResolvedValue({ ...listing, images: ["https://x.test/1.jpg", "https://x.test/2.jpg"], description: "d".repeat(300) });
    const metadata = await listingMetadata({ params: Promise.resolve({ locale: "en", id: "1" }) });
    expect(metadata.title).toEqual(expect.stringContaining("For sale"));
    expect(metadata.description).toHaveLength(160);
    expect(metadata.alternates?.canonical).toBe(`/en/listings/${listing.id}`);
    expect(metadata.openGraph?.images).toEqual(["https://x.test/1.jpg"]);
  });

  it("adds nothing for a listing that does not exist", async () => {
    db.getListing.mockResolvedValue(undefined);
    expect(await listingMetadata({ params: Promise.resolve({ locale: "en", id: "2" }) })).toEqual({});
  });

  it("titles the brokers and prices pages", async () => {
    expect(await brokersMetadata({ params: locale("en") })).toMatchObject({ title: "MTeam brokers", alternates: { canonical: "/en/brokers" } });
    db.priceStats.mockResolvedValue([{ district: "ვაკე", rooms: 2, median: 1550 }]);
    const prices = await pricesMetadata({ params: locale("ru"), searchParams: query({}) });
    expect(prices).toMatchObject({ title: "Цены по районам · Тбилиси · Продажа", alternates: { canonical: "/ru/prices" } });
    expect(prices.robots).toBeUndefined();
  });

  it("keeps a prices page with no figures out of the index", async () => {
    db.priceStats.mockResolvedValue([]);
    expect((await pricesMetadata({ params: locale("en"), searchParams: query({ city: "ბათუმი" }) })).robots).toEqual({ index: false, follow: true });
  });

  it("gives each city's prices their own address, and the default figures one address", async () => {
    db.priceStats.mockResolvedValue([]);
    const batumi = await pricesMetadata({ params: locale("en"), searchParams: query({ city: "ბათუმი", deal: "rent" }) });
    expect(batumi.title).toBe("Prices by district · Batumi · For rent");
    expect(batumi.alternates?.canonical).toBe(`/en/prices?${new URLSearchParams({ deal: "rent", city: "ბათუმი" })}`);
    expect((await pricesMetadata({ params: locale("en"), searchParams: query({ city: "თბილისი", deal: "sale" }) })).alternates?.canonical).toBe("/en/prices");
  });
});

describe("sitemap", () => {
  it("lists pages, searches and listings, written so the XML stays valid", async () => {
    vi.stubEnv("SITE_URL", "https://example.test/");
    const updatedAt = new Date("2026-11-01");
    db.sitemapListings.mockResolvedValue([{ id: 7, updatedAt }]);
    db.sitemapSearches.mockResolvedValue([{ deal: "sale", type: "apartment", city: "Batumi" }]);
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://example.test/ka",
      "https://example.test/ka/brokers",
      "https://example.test/ka/prices",
      "https://example.test/ka/mortgage",
      "https://example.test/ka?deal=sale&amp;type=apartment&amp;city=Batumi",
      "https://example.test/ka/listings/7",
    ]);
    expect(entries[5]).toMatchObject({ lastModified: updatedAt, alternates: { languages: { en: "https://example.test/en/listings/7" } } });
    expect(entries.flatMap((entry) => Object.values(entry.alternates?.languages ?? {})).join(" ")).not.toMatch(/&(?!amp;)/);
  });
});

describe("robots", () => {
  it("keeps private pages out, leaves listings in, and names the sitemap", () => {
    vi.stubEnv("SITE_URL", "https://example.test");
    const result = robots();
    const { disallow } = result.rules as { disallow: string[] };
    expect(disallow).toEqual(expect.arrayContaining(["/api/", "/ka/admin", "/ru/listings/new", "/en/my-listings"]));
    expect(disallow).not.toContain("/ka/listings");
    expect(result.sitemap).toBe("https://example.test/sitemap.xml");
  });
});
