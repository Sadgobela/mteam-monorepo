// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ countListings: vi.fn(async () => 34), getHiddenIds: vi.fn(async () => [5]), claimAssistantQuery: vi.fn(async () => true) }));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), clientIp: async () => "1.2.3.4" }));
const ai = vi.hoisted(() => ({ interpretSearch: vi.fn() }));
vi.mock("@mteam/db", () => db);
vi.mock("./session", () => session);
vi.mock("./assistant-ai", () => ai);

import { askAssistantAction, countSearchAction } from "./search-actions";

beforeEach(() => vi.clearAllMocks());

describe("countSearchAction", () => {
  it("counts a search's listings, ignoring unknown parameters", async () => {
    session.currentUser.mockResolvedValue(null);
    expect(await countSearchAction("deal=sale&rooms=2&castle=1")).toBe(34);
    expect(db.countListings).toHaveBeenCalledWith(expect.objectContaining({ deal: "sale", rooms: 2 }), { hiddenIds: [] });
    expect(db.countListings.mock.calls[0]).not.toHaveProperty("0.castle");
  });

  it("leaves out listings the visitor hid", async () => {
    session.currentUser.mockResolvedValue({ id: "u1" });
    await countSearchAction("deal=rent");
    expect(db.getHiddenIds).toHaveBeenCalledWith("u1");
    expect(db.countListings).toHaveBeenCalledWith(expect.objectContaining({ deal: "rent" }), { hiddenIds: [5] });
  });
});

describe("askAssistantAction", () => {
  it("returns the search the AI understood, counting the question against the address", async () => {
    ai.interpretSearch.mockResolvedValue("deal=sale&rooms=2");
    expect(await askAssistantAction("  2 rooms to buy ", "deal=rent")).toEqual({ search: "deal=sale&rooms=2" });
    expect(db.claimAssistantQuery).toHaveBeenCalledWith("1.2.3.4");
    expect(ai.interpretSearch).toHaveBeenCalledWith("2 rooms to buy", "deal=rent");
  });

  it("refuses empty or overlong text without asking the AI", async () => {
    expect(await askAssistantAction("   ", "")).toEqual({ error: "unclear" });
    expect(await askAssistantAction("x".repeat(301), "")).toEqual({ error: "unclear" });
    expect(db.claimAssistantQuery).not.toHaveBeenCalled();
  });

  it("stops an address past its limit", async () => {
    db.claimAssistantQuery.mockResolvedValueOnce(false);
    expect(await askAssistantAction("flat", "")).toEqual({ error: "busy" });
    expect(ai.interpretSearch).not.toHaveBeenCalled();
  });

  it("reports text it could not use, and failures", async () => {
    ai.interpretSearch.mockResolvedValueOnce(null);
    expect(await askAssistantAction("hello", "")).toEqual({ error: "unclear" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    ai.interpretSearch.mockRejectedValueOnce(new Error("down"));
    expect(await askAssistantAction("flat", "")).toEqual({ error: "failed" });
    expect(log).toHaveBeenCalled();
  });
});
