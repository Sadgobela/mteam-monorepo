// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { parse } };
  },
}));

import { filtersToSearch, interpretSearch, type UnderstoodFilters } from "./assistant-ai";

const none: UnderstoodFilters = {
  understood: true,
  deal: null,
  type: null,
  city: null,
  districts: [],
  priceMin: null,
  priceMax: null,
  currency: "USD",
  rooms: null,
  building: [],
  belowMarket: false,
};

beforeEach(() => parse.mockReset());

describe("filtersToSearch", () => {
  it("turns understood filters into canonical URL parameters", () => {
    expect(
      filtersToSearch({ ...none, deal: "sale", type: "apartment", city: "თბილისი", districts: ["ვაკე", "საბურთალო"], priceMin: 50000, priceMax: 120000, rooms: 2, building: ["new"], belowMarket: true }),
    ).toBe("belowMarket=1&building=new&city=%E1%83%97%E1%83%91%E1%83%98%E1%83%9A%E1%83%98%E1%83%A1%E1%83%98&deal=sale&district=%E1%83%95%E1%83%90%E1%83%99%E1%83%94%7C%E1%83%A1%E1%83%90%E1%83%91%E1%83%A3%E1%83%A0%E1%83%97%E1%83%90%E1%83%9A%E1%83%9D&priceMax=120000&priceMin=50000&rooms=2&type=apartment");
  });

  it("converts lari to dollars and drops what the search does not accept", () => {
    expect(filtersToSearch({ ...none, deal: "rent", priceMax: 2700, currency: "GEL" })).toBe("deal=rent&priceMax=1000");
    expect(filtersToSearch({ ...none, city: "Atlantis", districts: ["ვაკე"], rooms: 40 })).toBe("");
  });
});

describe("interpretSearch", () => {
  const reply = (parsed_output: UnderstoodFilters | null, stop_reason = "end_turn") => parse.mockResolvedValue({ parsed_output, stop_reason });

  it("sends the message and current search, and returns the updated search", async () => {
    reply({ ...none, deal: "rent", rooms: 2 });
    expect(await interpretSearch("2 ოთახიანი ქირით", "deal=sale")).toBe("deal=rent&rooms=2");
    const request = parse.mock.calls[0][0];
    expect(request.messages[0].content).toBe("Current search: deal=sale\n\n<message>\n2 ოთახიანი ქირით\n</message>");
    expect(request.system).toContain("თბილისი: ");
    expect(request.output_config.effort).toBe("low");
  });

  it("says so when there is no current search", async () => {
    reply({ ...none, deal: "sale" });
    await interpretSearch("buy", "");
    expect(parse.mock.calls[0][0].messages[0].content).toContain("Current search: none");
  });

  it("returns null for an off-topic message, a refusal, a parse failure or an empty search", async () => {
    reply({ ...none, understood: false, deal: "sale" });
    expect(await interpretSearch("hello", "")).toBeNull();
    reply({ ...none, deal: "sale" }, "refusal");
    expect(await interpretSearch("x", "")).toBeNull();
    reply(null);
    expect(await interpretSearch("x", "")).toBeNull();
    reply(none);
    expect(await interpretSearch("anything", "")).toBeNull();
  });
});
