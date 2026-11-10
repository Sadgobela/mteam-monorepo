import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  listing: { findFirst: vi.fn() },
  listingReport: { createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));
vi.mock("./auth", () => ({ addressHash: (ip: string) => `hash:${ip}` }));

import { listOpenReports, reportListing, resolveReport } from "./reports";

beforeEach(() => vi.clearAllMocks());

describe("reportListing", () => {
  it("stores one report per address, hashed", async () => {
    prisma.listing.findFirst.mockResolvedValue({ id: 7 });
    await reportListing(7, { reason: "fake" }, "1.2.3.4");
    expect(prisma.listingReport.createMany).toHaveBeenCalledWith({ data: [{ listingId: 7, reason: "fake", ipHash: "hash:1.2.3.4" }], skipDuplicates: true });
  });

  it("ignores a listing that is not published", async () => {
    prisma.listing.findFirst.mockResolvedValue(null);
    await reportListing(7, { reason: "fake" }, "1.2.3.4");
    expect(prisma.listingReport.createMany).not.toHaveBeenCalled();
  });
});

describe("reviewing reports", () => {
  it("lists only open reports, oldest first", async () => {
    prisma.listingReport.findMany.mockResolvedValue([]);
    await listOpenReports();
    expect(prisma.listingReport.findMany.mock.calls[0][0]).toMatchObject({ where: { resolved: false }, orderBy: { createdAt: "asc" } });
  });

  it("marks a report as dealt with", async () => {
    await resolveReport("r1");
    expect(prisma.listingReport.updateMany).toHaveBeenCalledWith({ where: { id: "r1" }, data: { resolved: true } });
  });
});
