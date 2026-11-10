import { describe, expect, it } from "vitest";
import { canonicalSearch, priceInLari, convertPrice, parseListingDisplay, parseListingFilters, priceInUsd } from "./index";

describe("priceInLari", () => {
  it("reads round lari amounts back exactly", () => {
    expect(priceInLari(priceInUsd(150000, "GEL"))).toBe(150000);
    expect(priceInLari(priceInUsd(250000, "GEL"))).toBe(250000);
  });

  it("falls back to the exact conversion when rounding would change the dollars", () => {
    expect(priceInLari(1)).toBe(3);
  });
});

describe("canonicalSearch", () => {
  it("keeps only real filters, in a fixed order", () => {
    expect(canonicalSearch({ sort: "asc", rooms: "2", deal: "sale", page: "3", junk: "x" })).toBe("deal=sale&rooms=2");
  });

  it("is empty with no filters, or too many to keep", () => {
    expect(canonicalSearch({ sort: "asc" })).toBe("");
    expect(canonicalSearch({ city: "თბილისი", street: "ქ".repeat(1500) })).toBe("");
  });
});

describe("parseListingFilters", () => {
  it("reads several districts inside a city", () => {
    expect(parseListingFilters({ city: "თბილისი", district: "ვაკე|ვერა" })).toEqual({ city: "თბილისი", district: ["ვაკე", "ვერა"] });
  });

  it("reads metro, building status, owners and price per m²", () => {
    expect(parseListingFilters({ metro: "დელისი", building: "old|new|old|castle", owner: "1", sqmMin: "500", sqmMax: "900" })).toMatchObject({
      metro: "დელისი",
      building: ["old", "new"],
      owner: true,
      sqmMin: 500,
      sqmMax: 900,
    });
  });

  it("keeps a metro station only in the city with a metro, or with no city chosen", () => {
    expect(parseListingFilters({ city: "თბილისი", metro: "დელისი" }).metro).toBe("დელისი");
    expect(parseListingFilters({ city: "ბათუმი", metro: "დელისი" }).metro).toBeUndefined();
    expect(parseListingFilters({ metro: "დელისი" }).metro).toBe("დელისი");
  });

  it("reads details, features, and the new ranges", () => {
    expect(parseListingFilters({ heating: "central|castle|central", features: "lift|castle", bedrooms: "10", floorPos: "notLast", floorsMin: "3", ceilingMin: "2.75" })).toMatchObject({
      heating: ["central"],
      features: ["lift"],
      bedrooms: 10,
      floorPos: "notLast",
      floorsMin: 3,
      ceilingMin: 2.75,
    });
  });

  it("ignores unknown details, features and floor positions", () => {
    expect(parseListingFilters({ heating: "castle", features: "castle", floorPos: "roof", bedrooms: "11", ceilingMin: "high" })).toEqual({});
  });

  it("ignores an unknown metro station or building status", () => {
    expect(parseListingFilters({ metro: "Atlantis", building: "castle", owner: "yes" })).toMatchObject({ metro: undefined, building: undefined, owner: undefined });
  });

  it("reads streets inside a city, keeping commas in their names and dropping blanks and repeats", () => {
    expect(parseListingFilters({ city: "თბილისი", street: "ა, ქ.|ბ ქ.|ბ ქ.|" }).street).toEqual(["ა, ქ.", "ბ ქ."]);
    expect(parseListingFilters({ city: "თბილისი", street: "|" }).street).toBeUndefined();
    expect(parseListingFilters({ street: "ა ქ." }).street).toBeUndefined();
  });

  it("ignores districts without a city, and a city that does not exist", () => {
    expect(parseListingFilters({ district: "ვაკე" }).district).toBeUndefined();
    expect(parseListingFilters({ city: "Atlantis", district: "ვაკე" })).toEqual({ city: undefined, district: undefined });
  });

  it("keeps only real districts of that city, once each", () => {
    expect(parseListingFilters({ city: "თბილისი", district: "ვაკე|ვაკე||Atlantis" }).district).toEqual(["ვაკე"]);
    expect(parseListingFilters({ city: "ბათუმი", district: "ვაკე" }).district).toBeUndefined();
    expect(parseListingFilters({ city: "თბილისი", district: "|||" }).district).toBeUndefined();
  });

  it("ignores an empty or absurdly long district list", () => {
    expect(parseListingFilters({ city: "თბილისი", district: "" }).district).toBeUndefined();
    expect(parseListingFilters({ city: "თბილისი", district: "a".repeat(4001) }).district).toBeUndefined();
  });

  it("reads every filter", () => {
    expect(
      parseListingFilters({ deal: "rent", type: "house", city: "ბათუმი", priceMin: "1000", priceMax: "2000", rooms: "3", q: " vake ", verified: "1", areaMin: "40", areaMax: "90", floorMin: "3", floorMax: "9" }),
    ).toEqual({ deal: "rent", type: "house", city: "ბათუმი", priceMin: 1000, priceMax: 2000, rooms: 3, q: "vake", verified: true, areaMin: 40, areaMax: 90, floorMin: 3, floorMax: 9 });
  });

  it("treats a query with no filters as no filters", () => {
    expect(parseListingFilters({})).toEqual({});
  });

  it("treats the empty fields of a submitted form as off", () => {
    expect(parseListingFilters({ deal: "", type: "", city: "", priceMin: "", priceMax: "", rooms: "", q: "  ", verified: "" })).toEqual({});
  });

  it("keeps a price of zero", () => {
    expect(parseListingFilters({ priceMin: "0" }).priceMin).toBe(0);
  });

  it.each([
    ["deal", "barter"],
    ["type", "projects"],
    ["city", "Atlantis"],
    ["rooms", "0"],
    ["rooms", "11"],
    ["rooms", "1.5"],
    ["priceMin", "abc"],
    ["priceMin", "-5"],
    ["priceMin", "1e3"],
    ["priceMax", "100000001"],
    ["priceMax", "9999999999"],
    ["verified", "true"],
    ["belowMarket", "yes"],
    ["areaMin", "abc"],
    ["areaMax", "12345678"],
    ["floorMin", "abc"],
    ["floorMax", "-1"],
    ["q", "x".repeat(101)],
    ["q", "a\0b"],
  ])("ignores %s=%s", (key, value) => {
    expect(parseListingFilters({ [key]: value })).toEqual({});
  });

  it("keeps valid filters next to an invalid one", () => {
    expect(parseListingFilters({ deal: "sale", rooms: "99" })).toEqual({ deal: "sale" });
  });

  it("ignores a filter given twice", () => {
    expect(parseListingFilters({ deal: ["sale", "rent"] })).toEqual({});
  });

  it("drops parameters it does not know", () => {
    expect(parseListingFilters({ bogus: "vake", deal: "sale" })).toEqual({ deal: "sale" });
  });

  it("accepts the largest allowed price", () => {
    expect(parseListingFilters({ priceMax: "100000000" }).priceMax).toBe(100000000);
  });
});

describe("parseListingDisplay", () => {
  const defaults = { sort: "new", view: "grid", cur: "usd", page: 1 };

  it("defaults everything", () => {
    expect(parseListingDisplay({})).toEqual(defaults);
  });

  it("reads valid values", () => {
    expect(parseListingDisplay({ sort: "desc", view: "list", cur: "gel", page: "3" })).toEqual({
      sort: "desc",
      view: "list",
      cur: "gel",
      page: 3,
    });
  });

  it.each(["0", "-1", "1e3", "abc", "1234567"])("falls back to page 1 for %s", (page) => {
    expect(parseListingDisplay({ page }).page).toBe(1);
  });

  it("falls back on invalid or repeated values", () => {
    expect(parseListingDisplay({ sort: "price", view: "cards", cur: "eur", page: ["1", "2"] })).toEqual(defaults);
  });
});

describe("currency conversion", () => {
  it("normalizes each currency to USD", () => {
    expect(priceInUsd(1000, "USD")).toBe(1000);
    expect(priceInUsd(2700, "GEL")).toBe(1000);
    expect(priceInUsd(270000, "GEL")).toBe(100000);
  });

  it("converts for display", () => {
    expect(convertPrice(1000, "USD", "usd")).toBe(1000);
    expect(convertPrice(1000, "USD", "gel")).toBe(2700);
    expect(convertPrice(2700, "GEL", "usd")).toBe(1000);
    expect(convertPrice(2700, "GEL", "gel")).toBe(2700);
    expect(convertPrice(270000, "GEL", "usd")).toBe(100000);
  });
});

