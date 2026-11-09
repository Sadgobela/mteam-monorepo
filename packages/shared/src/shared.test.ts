import { describe, expect, it } from "vitest";
import { defaultLocale, districtOptions, formatDay, formatPrice, getDictionary, isLocale, locales, placeName } from "./index";

describe("formatDay", () => {
  it("writes a short date in the page language, independent of time zone", () => {
    expect(formatDay("2026-11-06", "en")).toBe("Nov 6");
    expect(formatDay("2026-11-06T23:30:00Z", "en")).toBe("Nov 6");
  });
});

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

describe("districtOptions", () => {
  it("labels districts in the page language and keeps the stored name as the value", () => {
    expect(districtOptions("en")).toContainEqual({ value: "ვაკე", label: "Vake" });
    expect(districtOptions("ru")).toContainEqual({ value: "ვაკე", label: "Ваке" });
    expect(districtOptions("ka")).toContainEqual({ value: "ვაკე", label: "ვაკე" });
  });
});

describe("placeName", () => {
  const place = (city: string, district: string, locale: "ka" | "en" | "ru") => placeName({ city, district }, locale, getDictionary(locale));

  it("shows the district as written on the Georgian page", () => {
    expect(place("თბილისი", " ვაკე ", "ka")).toBe("ვაკე");
    expect(place("თბილისი", "სადღაც", "ka")).toBe("სადღაც");
  });

  it("translates a known district", () => {
    expect(place("თბილისი", "ვაკე", "en")).toBe("Vake");
    expect(place("თბილისი", "საბურთალო", "ru")).toBe("Сабуртало");
  });

  it("falls back to the translated city", () => {
    expect(place("ბათუმი", "სადღაც", "en")).toBe("Batumi");
    expect(place("თბილისი", "", "ka")).toBe("თბილისი");
  });

  it("is not fooled by a district named after a built-in property", () => {
    expect(place("თბილისი", "constructor", "en")).toBe("Tbilisi");
  });

  it("gives nothing for a city it does not know", () => {
    expect(place("Kutaisi", "სადღაც", "en")).toBeUndefined();
  });
});
