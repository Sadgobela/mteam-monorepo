import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  exchangeRate: { findUnique: vi.fn(), upsert: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn((steps: Promise<unknown>[]) => Promise.all(steps)),
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { getGelPerUsd, saveGelPerUsd } from "./index";

beforeEach(() => vi.clearAllMocks());

describe("getGelPerUsd", () => {
  it("reads the stored rate, or the fallback before the first one", async () => {
    prisma.exchangeRate.findUnique.mockResolvedValueOnce({ gelPerUnit: 2.5931 });
    expect(await getGelPerUsd()).toBe(2.5931);
    prisma.exchangeRate.findUnique.mockResolvedValueOnce(null);
    expect(await getGelPerUsd()).toBe(2.7);
  });
});

describe("saveGelPerUsd", () => {
  it("stores the rate and reprices lari listings in one transaction", async () => {
    prisma.exchangeRate.upsert.mockResolvedValue({});
    prisma.$executeRaw.mockResolvedValue(3);
    const validFrom = new Date("2026-11-17T00:00:00Z");
    expect(await saveGelPerUsd(2.5931, validFrom)).toBe(3);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith({
      where: { currency: "USD" },
      create: { currency: "USD", gelPerUnit: 2.5931, validFrom },
      update: { gelPerUnit: 2.5931, validFrom },
    });
    const [sql, ...values] = prisma.$executeRaw.mock.calls[0];
    expect(sql.join("?")).toContain(`WHERE currency = 'GEL' AND area > 0`);
    expect(values).toEqual([2.5931, 2.5931]);
  });
});
