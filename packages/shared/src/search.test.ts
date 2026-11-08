import { describe, expect, it } from "vitest";
import { cityNames, convertPrice, parseListingDisplay, parseListingFilters, priceInUsd } from "./index";

describe("parseListingFilters", () => {
  it("reads every filter", () => {
    expect(
      parseListingFilters({ deal: "rent", type: "house", city: "batumi", priceMin: "1000", priceMax: "2000", rooms: "3", q: " vake ", verified: "1", areaMin: "40", areaMax: "90" }),
    ).toEqual({ deal: "rent", type: "house", city: "batumi", priceMin: 1000, priceMax: 2000, rooms: 3, q: "vake", verified: true, areaMin: 40, areaMax: 90 });
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
    ["deal", "lease"],
    ["type", "projects"],
    ["city", "თბილისი"],
    ["rooms", "0"],
    ["rooms", "5"],
    ["rooms", "1.5"],
    ["priceMin", "abc"],
    ["priceMin", "-5"],
    ["priceMin", "1e3"],
    ["priceMax", "100000001"],
    ["priceMax", "9999999999"],
    ["verified", "true"],
    ["areaMin", "abc"],
    ["areaMax", "12345678"],
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
    expect(priceInUsd(1450000, "AED")).toBe(394826);
  });

  it("converts for display", () => {
    expect(convertPrice(1000, "USD", "usd")).toBe(1000);
    expect(convertPrice(1000, "USD", "gel")).toBe(2700);
    expect(convertPrice(2700, "GEL", "usd")).toBe(1000);
    expect(convertPrice(2700, "GEL", "gel")).toBe(2700);
    expect(convertPrice(1450000, "AED", "usd")).toBe(394826);
  });
});

describe("cityNames", () => {
  it("matches the city names stored on listings", () => {
    expect(cityNames).toEqual({ tbilisi: "თბილისი", batumi: "ბათუმი", dubai: "დუბაი" });
  });
});
