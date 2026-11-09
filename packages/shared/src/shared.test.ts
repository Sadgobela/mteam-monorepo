import { describe, expect, it } from "vitest";
import { streetsIn } from "./streets";
import { cities, cityAreas, cityDistricts, defaultLocale, formatDay, formatPrice, getDictionary, isCity, isLocale, locales, placeLabel, placeName, popularCities, priceUnit } from "./index";

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

describe("priceUnit", () => {
  it("says what a price is per, and nothing for one-off deals", () => {
    const t = getDictionary("en");
    expect(priceUnit("rent", t)).toBe("/ month");
    expect(priceUnit("lease", t)).toBe("/ month");
    expect(priceUnit("daily", t)).toBe("/ day");
    expect(priceUnit("sale", t)).toBeUndefined();
    expect(priceUnit("pledge", t)).toBeUndefined();
  });
});

describe("places", () => {
  it("lists every city once, popular ones first", () => {
    expect(new Set(cities).size).toBe(cities.length);
    expect(popularCities[0]).toBe("თბილისი");
    expect(popularCities).toHaveLength(10);
    expect(isCity("ქუთაისი")).toBe(true);
    expect(isCity("დუბაი")).toBe(false);
  });

  it("never lists a district twice in one city", () => {
    for (const city of cities) expect(new Set(cityDistricts(city)).size).toBe(cityDistricts(city).length);
  });

  it("gives a city's groups and plain districts, and nothing for an unknown city", () => {
    expect(cityAreas("თბილისი").find((area) => area.name === "ვაკე-საბურთალო")?.districts).toContain("ვაკე");
    expect(cityAreas("ბათუმი")).toContainEqual({ name: "მახინჯაური", districts: ["მახინჯაური"] });
    expect(cityDistricts("თბილისი")).toContain("ვერა");
    expect(cityDistricts("რუსთავი")).toEqual([]);
    expect(cityDistricts("Atlantis")).toEqual([]);
  });

  it("spells place names in the page language", () => {
    expect(placeLabel("ვაკე", "ka")).toBe("ვაკე");
    expect(placeLabel("ვაკე-საბურთალო", "en")).toBe("Vake-Saburtalo");
    expect(placeLabel("ჩუღურეთი", "ru")).toBe("Чугурети");
    expect(placeLabel("გორის მუნიციპალიტეტი", "en")).toBe("Goris Municipality");
    expect(placeLabel("ონის რაიონი", "ru")).toBe("Онис район");
    expect(placeLabel("Old town", "en")).toBe("Old Town");
    expect(placeLabel("რუსთაველის გამზირი", "en")).toBe("Rustavelis Ave.");
    expect(placeLabel("ატენის ქ.", "ru")).toBe("Атенис ул.");
  });
});

describe("streetsIn", () => {
  it("gives a whole city's streets when they are not split by district", () => {
    expect(streetsIn("რუსთავი", [])).toHaveLength(115);
  });

  it("gives only the chosen districts' streets, and none before one is chosen", () => {
    expect(streetsIn("თბილისი", ["ვაკე"])).toContain("ჭავჭავაძე ი. გამზირი");
    expect(streetsIn("თბილისი", ["ვაკე", "ვაშლიჯვარი"]).length).toBeGreaterThan(streetsIn("თბილისი", ["ვაკე"]).length);
    expect(streetsIn("თბილისი", [])).toEqual([]);
    expect(streetsIn("თბილისი", ["მუხათგვერდი"])).toEqual([]);
  });

  it("has nothing for a place without streets", () => {
    expect(streetsIn("Atlantis", [])).toEqual([]);
  });

  it("sorts in Georgian alphabetical order without repeats", () => {
    const names = streetsIn("თბილისი", ["ვაკე", "ვერა"]);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort((a, b) => a.localeCompare(b, "ka"))).toEqual(names);
  });
});

describe("placeName", () => {
  it("names the district, or the city when there is none", () => {
    expect(placeName({ city: "თბილისი", district: "ვაკე" }, "en")).toBe("Vake");
    expect(placeName({ city: "ბათუმი", district: " " }, "ru")).toBe("Батуми");
    expect(placeName({ city: "რუსთავი", district: "" }, "ka")).toBe("რუსთავი");
  });
});
