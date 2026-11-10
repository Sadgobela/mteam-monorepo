import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ $executeRaw: vi.fn(), $queryRaw: vi.fn() }));

vi.mock("./client", () => ({ db: () => prisma }));

import { priceStats } from "./index";
import { refreshMarketLevels } from "./market";

beforeEach(() => vi.resetAllMocks());

describe("refreshMarketLevels", () => {
  it("says how many listings changed", async () => {
    prisma.$executeRaw.mockResolvedValue(7);
    expect(await refreshMarketLevels()).toBe(7);
  });
});

describe("priceStats", () => {
  it("reads what the database returns as plain numbers, rounded", async () => {
    prisma.$queryRaw.mockResolvedValue([{ district: "ვაკე", rooms: 2n, median: 1550.5 }]);
    expect(await priceStats("თბილისი", "sale")).toEqual([{ district: "ვაკე", rooms: 2, median: 1551 }]);
  });

  it("passes the city and deal as parameters", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await priceStats("თბილისი", "rent");
    expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual(expect.arrayContaining(["RENT", "თბილისი", 5]));
  });

  it("refuses a result of the wrong shape", async () => {
    prisma.$queryRaw.mockResolvedValue([{ district: null }]);
    await expect(priceStats("თბილისი", "sale")).rejects.toThrow();
  });
});
