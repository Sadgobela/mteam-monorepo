import { describe, expect, it } from "vitest";
import { resultsHref } from "./url";

describe("resultsHref", () => {
  it("keeps existing parameters and applies the change", () => {
    expect(resultsHref("en", { deal: "sale", sort: "new" }, { sort: "asc" })).toBe("/en?deal=sale&sort=asc");
  });

  it("keeps an empty search, which still means the results view", () => {
    expect(resultsHref("ka", { deal: "" }, { view: "list" })).toBe("/ka?deal=&view=list");
  });

  it("drops repeated and missing parameters", () => {
    expect(resultsHref("en", { deal: ["a", "b"], city: undefined }, { view: "list" })).toBe("/en?view=list");
  });

  it("returns the bare page with nothing to add", () => {
    expect(resultsHref("ru", {}, {})).toBe("/ru");
  });

  it("escapes values", () => {
    expect(resultsHref("en", { q: "a&b" }, {})).toBe("/en?q=a%26b");
  });
});
