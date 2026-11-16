// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isCrossSite } from "./same-origin";

const from = (origin?: string) => new Request("https://mteam.ge/api/listings", { method: "POST", headers: origin === undefined ? {} : { origin } });

describe("isCrossSite", () => {
  it("accepts our own pages, and requests that name no origin", () => {
    expect(isCrossSite(from("https://mteam.ge"))).toBe(false);
    expect(isCrossSite(from())).toBe(false);
  });

  it.each([["https://evil.test"], ["https://mteam.ge.evil.test"], ["null"]])("refuses a request from %s", (origin) => {
    expect(isCrossSite(from(origin))).toBe(true);
  });
});
