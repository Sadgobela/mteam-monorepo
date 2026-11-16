// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ saveGelPerUsd: vi.fn(async () => 3), refreshMarketLevels: vi.fn(async () => 40), archiveExpiredListings: vi.fn(async () => 2), runNightlyNotifications: vi.fn(async () => 5) }));
vi.mock("@mteam/db", () => db);

import { GET } from "./route";

const SECRET = "s".repeat(32);
const call = (authorization?: string) => GET(new Request("https://site/api/cron/nightly", { headers: authorization ? { authorization } : {} }));
const nbg = (currencies: unknown[]) => [{ date: "2026-11-17T00:00:00.000Z", currencies }];
const usd = { code: "USD", quantity: 1, rate: 2.5931, validFromDate: "2026-11-17T00:00:00.000Z" };
const feed = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubGlobal("fetch", feed);
  feed.mockResolvedValue(Response.json(nbg([usd])));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("nightly job", () => {
  it("stores the National Bank rate, then refreshes market levels", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ gelPerUsd: 2.5931, repriced: 3, marketLevels: 40, expired: 2, notified: 5 });
    expect(db.saveGelPerUsd).toHaveBeenCalledWith(2.5931, new Date("2026-11-17T00:00:00.000Z"));
    expect(db.saveGelPerUsd.mock.invocationCallOrder[0]).toBeLessThan(db.refreshMarketLevels.mock.invocationCallOrder[0]);
    expect(db.archiveExpiredListings.mock.invocationCallOrder[0]).toBeLessThan(db.runNightlyNotifications.mock.invocationCallOrder[0]);
    expect(console.info).toHaveBeenCalledWith("nightly: rate 2.5931, repriced 3, market levels 40, expired 2, notified 5");
  });

  it("divides by the quantity the rate is quoted for", async () => {
    feed.mockResolvedValue(Response.json(nbg([{ ...usd, quantity: 10, rate: 25.931 }])));
    await call(`Bearer ${SECRET}`);
    expect(db.saveGelPerUsd).toHaveBeenCalledWith(2.5931, expect.any(Date));
  });

  it.each([
    ["no header", undefined],
    ["a wrong secret", `Bearer ${"x".repeat(32)}`],
    ["a different length", "Bearer short"],
  ])("refuses %s", async (_name, authorization) => {
    expect((await call(authorization)).status).toBe(401);
    expect(feed).not.toHaveBeenCalled();
  });

  it("refuses everyone when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
  });

  it.each([
    ["a failed response", () => new Response("down", { status: 503 })],
    ["an unexpected shape", () => Response.json(nbg([{ ...usd, code: "EUR" }]))],
    ["a rate outside the sane band", () => Response.json(nbg([{ ...usd, rate: 0.5 }]))],
    ["a rate far too high", () => Response.json(nbg([{ ...usd, rate: 27 }]))],
  ])("keeps the old rate on %s, still refreshes market levels, and reports failure", async (_name, reply) => {
    feed.mockResolvedValue(reply());
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ gelPerUsd: null, repriced: 0, marketLevels: 40, expired: 2, notified: 5 });
    expect(db.saveGelPerUsd).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith("nightly: rate kept, repriced 0, market levels 40, expired 2, notified 5");
  });

  it("keeps the old rate when the bank cannot be reached", async () => {
    feed.mockRejectedValue(new Error("timeout"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(502);
    expect(console.error).toHaveBeenCalled();
    expect(db.saveGelPerUsd).not.toHaveBeenCalled();
  });
});
