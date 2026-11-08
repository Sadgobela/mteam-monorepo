import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seed } from "./seed";

function fakeClient() {
  return {
    branch: { upsert: vi.fn().mockResolvedValue({}) },
    user: { upsert: vi.fn().mockResolvedValue({ id: "u1" }) },
    agent: { upsert: vi.fn().mockResolvedValue({ id: "a1" }) },
    listing: { upsert: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

beforeEach(() => vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db"));
afterEach(() => vi.unstubAllEnvs());

describe("seed", () => {
  it.each(["postgresql://db.example.com:5432/db", "", undefined])("refuses to touch a non-local database (%j)", async (url) => {
    vi.stubEnv("DATABASE_URL", url as string);
    const client = fakeClient();
    await expect(seed(client as unknown as PrismaClient)).rejects.toThrow();
    expect(client.branch.upsert).not.toHaveBeenCalled();
    expect(client.listing.upsert).not.toHaveBeenCalled();
  });

  it("publishes the four demo listings and links brokers only where assigned", async () => {
    const client = fakeClient();
    await seed(client as unknown as PrismaClient);

    const rows = client.listing.upsert.mock.calls.map(([args]) => args.create);
    expect(rows.map((r) => r.id)).toEqual([20418, 20422, 20431, 20440]);
    expect(rows.every((r) => r.status === "ACTIVE" && r.ownerId === "u1")).toBe(true);
    expect(rows.map((r) => r.agentId)).toEqual(["a1", null, "a1", "a1"]);
    expect(rows[0]).not.toHaveProperty("brokered");
  });

  it("writes the same data on re-run, so seeding is repeatable", async () => {
    const client = fakeClient();
    await seed(client as unknown as PrismaClient);
    for (const [args] of client.listing.upsert.mock.calls) {
      expect(args.update).toEqual(args.create);
      expect(args.where).toEqual({ id: args.create.id });
    }
  });

  it("advances the id sequence after the listings are written", async () => {
    const client = fakeClient();
    await seed(client as unknown as PrismaClient);
    expect(client.$executeRaw).toHaveBeenCalledOnce();
    expect(client.$executeRaw.mock.calls[0][0].join("")).toContain("setval");
    expect(client.$executeRaw.mock.invocationCallOrder[0]).toBeGreaterThan(
      Math.max(...client.listing.upsert.mock.invocationCallOrder),
    );
  });
});
