import { describe, expect, it } from "vitest";
import { cityNames, parseListingFilters } from "./index";

describe("parseListingFilters", () => {
  it("reads every filter", () => {
    expect(
      parseListingFilters({ deal: "rent", type: "house", city: "batumi", priceMin: "1000", priceMax: "2000", rooms: "3" }),
    ).toEqual({ deal: "rent", type: "house", city: "batumi", priceMin: 1000, priceMax: 2000, rooms: 3 });
  });

  it("treats a query with no filters as no filters", () => {
    expect(parseListingFilters({})).toEqual({});
  });

  it("treats the empty fields of a submitted form as off", () => {
    expect(parseListingFilters({ deal: "", type: "", city: "", priceMin: "", priceMax: "", rooms: "" })).toEqual({});
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
    expect(parseListingFilters({ q: "vake", deal: "sale" })).toEqual({ deal: "sale" });
  });

  it("accepts the largest allowed price", () => {
    expect(parseListingFilters({ priceMax: "100000000" }).priceMax).toBe(100000000);
  });
});

describe("cityNames", () => {
  it("matches the city names stored on listings", () => {
    expect(cityNames).toEqual({ tbilisi: "თბილისი", batumi: "ბათუმი", dubai: "დუბაი" });
  });
});
