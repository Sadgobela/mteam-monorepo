import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ priceStats: vi.fn(), claimDescriptionWrite: vi.fn() }));
const ai = vi.hoisted(() => ({ writeDescriptions: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), clientIp: vi.fn() }));
vi.mock("@mteam/db", () => db);
vi.mock("./description-ai", () => ai);
vi.mock("./session", () => session);

import { marketStatsAction, writeDescriptionAction } from "./post-actions";

beforeEach(() => vi.resetAllMocks());

describe("marketStatsAction", () => {
  it("gives the typical prices of a city for sale or rent", async () => {
    db.priceStats.mockResolvedValue([{ district: "ვაკე", rooms: 2, median: 2000 }]);
    expect(await marketStatsAction("თბილისი", "rent")).toEqual([{ district: "ვაკე", rooms: 2, median: 2000 }]);
    expect(db.priceStats).toHaveBeenCalledWith("თბილისი", "rent");
  });

  it.each([
    ["an unknown city", "Atlantis", "sale"],
    ["a deal the data does not cover", "თბილისი", "daily"],
  ])("asks nothing for %s", async (_name, city, deal) => {
    expect(await marketStatsAction(city, deal)).toEqual([]);
    expect(db.priceStats).not.toHaveBeenCalled();
  });
});

describe("writeDescriptionAction", () => {
  const fields = { deal: "sale", type: "apartment", city: "თბილისი", title: "Flat", price: "" };
  const descriptions = { ka: "ა", en: "a", ru: "а" };

  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    session.currentUser.mockResolvedValue({ id: "u1", phone: "+995555123456" });
    session.clientIp.mockResolvedValue("1.2.3.4");
    db.claimDescriptionWrite.mockResolvedValue(true);
    ai.writeDescriptions.mockResolvedValue(descriptions);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("writes the descriptions from the form's facts, counted against the address", async () => {
    expect(await writeDescriptionAction(fields)).toEqual({ descriptions });
    expect(ai.writeDescriptions).toHaveBeenCalledWith({ deal: "sale", type: "apartment", city: "თბილისი", title: "Flat" });
    expect(db.claimDescriptionWrite).toHaveBeenCalledWith("1.2.3.4", "u1");
  });

  it.each([
    ["without an AI key", () => vi.stubEnv("ANTHROPIC_API_KEY", "")],
    ["for a visitor", () => session.currentUser.mockResolvedValue(null)],
    ["for an account without a phone, which cannot post", () => session.currentUser.mockResolvedValue({ id: "u1", phone: null })],
  ])("does nothing %s", async (_name, arrange) => {
    arrange();
    expect(await writeDescriptionAction(fields)).toEqual({ error: "failed" });
    expect(db.claimDescriptionWrite).not.toHaveBeenCalled();
  });

  it.each([
    ["values that are not a form", "not a form"],
    ["a field filled in wrongly", { ...fields, area: "lots" }],
  ])("asks to check the fields for %s, without spending the quota", async (_name, input) => {
    expect(await writeDescriptionAction(input)).toEqual({ error: "unclear" });
    expect(db.claimDescriptionWrite).not.toHaveBeenCalled();
  });

  it("stops an account or address that asked too often", async () => {
    db.claimDescriptionWrite.mockResolvedValue(false);
    expect(await writeDescriptionAction(fields)).toEqual({ error: "busy" });
    expect(ai.writeDescriptions).not.toHaveBeenCalled();
  });

  it("reports nothing usable, and a failed request, as a failure", async () => {
    ai.writeDescriptions.mockResolvedValue(null);
    expect(await writeDescriptionAction(fields)).toEqual({ error: "failed" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    ai.writeDescriptions.mockRejectedValue(new Error("down"));
    expect(await writeDescriptionAction(fields)).toEqual({ error: "failed" });
    expect(log).toHaveBeenCalled();
  });
});
