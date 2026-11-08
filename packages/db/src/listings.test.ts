import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { countActiveListings, getFeaturedListings, getListing } from "./index";

const fullRow = {
  id: 20418,
  status: "ACTIVE",
  deal: "SALE",
  type: "APARTMENT",
  title: "Flat",
  description: "Sunny",
  city: "Tbilisi",
  district: "Vake",
  address: "Main 1",
  price: 148000,
  currency: "USD",
  area: 92,
  rooms: 3,
  floor: 7,
  floors: 12,
  condition: "New",
  verified: true,
  agent: { id: "a1", user: { name: "Nino", phone: "+995" }, branch: { name: "Vake" } },
  updatedAt: new Date("2026-11-06T10:00:00Z"),
};

const bareRow = {
  ...fullRow,
  id: 20421,
  deal: "DAILY",
  type: "LAND",
  district: null,
  address: null,
  rooms: null,
  floor: null,
  floors: null,
  condition: null,
  verified: false,
  agent: null,
};

beforeEach(() => vi.resetAllMocks());

describe("getListing", () => {
  it("maps a full row to the shared shape", async () => {
    prisma.listing.findFirst.mockResolvedValue(fullRow);
    expect(await getListing("20418")).toEqual({
      id: 20418,
      deal: "sale",
      type: "apartment",
      title: "Flat",
      description: "Sunny",
      city: "Tbilisi",
      district: "Vake",
      address: "Main 1",
      price: 148000,
      currency: "USD",
      area: 92,
      rooms: 3,
      floor: 7,
      floors: 12,
      condition: "New",
      verified: true,
      agent: { id: "a1", name: "Nino", branch: "Vake", phone: "+995" },
      tone: "steel",
      updatedAt: "2026-11-06",
    });
  });

  it("fills required fields and drops optional ones when the row has nulls", async () => {
    prisma.listing.findFirst.mockResolvedValue(bareRow);
    expect(await getListing("20421")).toMatchObject({
      deal: "daily",
      type: "land",
      district: "",
      address: "",
      rooms: 0,
      floor: undefined,
      floors: undefined,
      condition: undefined,
      agent: undefined,
      tone: "sand",
    });
  });

  it("copes with a broker who has no name or branch", async () => {
    prisma.listing.findFirst.mockResolvedValue({
      ...fullRow,
      agent: { id: "a2", user: { name: null, phone: "+995" }, branch: null },
    });
    expect((await getListing("20418"))?.agent).toEqual({ id: "a2", name: "", branch: "", phone: "+995" });
  });

  it("only looks up published listings and never selects owner data", async () => {
    prisma.listing.findFirst.mockResolvedValue(null);
    expect(await getListing("20418")).toBeUndefined();
    const args = prisma.listing.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ id: 20418, status: "ACTIVE" });
    expect(args.include).not.toHaveProperty("owner");
    expect(args.include.agent.include.user).toEqual({ select: { name: true, phone: true } });
  });

  it.each(["abc", "", "0", "-1", "1e3", " 12", "1.5", "0012", "2147483648", "99999999999"])(
    "treats %j as not found without querying",
    async (raw) => {
      expect(await getListing(raw)).toBeUndefined();
      expect(prisma.listing.findFirst).not.toHaveBeenCalled();
    },
  );

  it("accepts the largest id the column can hold", async () => {
    prisma.listing.findFirst.mockResolvedValue(null);
    await getListing("2147483647");
    expect(prisma.listing.findFirst.mock.calls[0][0].where.id).toBe(2147483647);
  });
});

describe("getFeaturedListings", () => {
  it("returns a bounded, newest-first page of published listings", async () => {
    prisma.listing.findMany.mockResolvedValue([fullRow, bareRow]);
    expect((await getFeaturedListings()).map((l) => l.id)).toEqual([20418, 20421]);
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({
      where: { status: "ACTIVE" },
      orderBy: { id: "desc" },
      take: 12,
    });
  });
});

describe("countActiveListings", () => {
  it("counts published listings only", async () => {
    prisma.listing.count.mockResolvedValue(4);
    expect(await countActiveListings()).toBe(4);
    expect(prisma.listing.count).toHaveBeenCalledWith({ where: { status: "ACTIVE" } });
  });
});
