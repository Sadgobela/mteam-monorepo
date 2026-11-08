import { describe, expect, it } from "vitest";
import { defaultLocale, formatPrice, getDictionary, getListing, isLocale, locales, sampleListings } from "./index";

describe("formatPrice", () => {
  it("formats each currency", () => {
    expect(formatPrice(148000, "USD")).toBe("$148,000");
    expect(formatPrice(250, "GEL")).toBe("₾250");
    expect(formatPrice(1450000, "AED")).toBe("AED 1,450,000");
  });
});

describe("i18n", () => {
  it("knows the supported languages", () => {
    expect(locales).toEqual(["ka", "en", "ru"]);
    expect(defaultLocale).toBe("ka");
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });

  it("has the same keys in every language", () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v).map((s) => `${k}.${s}`) : [k]));
    const ka = keys(getDictionary("ka")).sort();
    for (const l of locales) expect(keys(getDictionary(l)).sort()).toEqual(ka);
  });
});

describe("sample listings", () => {
  it("finds a listing by id", () => {
    expect(getListing(sampleListings[0].id)).toBe(sampleListings[0]);
    expect(getListing(-1)).toBeUndefined();
  });
});
