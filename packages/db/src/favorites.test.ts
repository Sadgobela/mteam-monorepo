import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  favorite: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  listing: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { archiveListing, getFavoriteIds, listFavorites, listMyListings, parseListingId, setFavorite } from "./index";

const row = {
  id: 7,
  status: "PENDING",
  deal: "SALE",
  type: "APARTMENT",
  title: "Flat",
  description: "Sunny",
  city: "Tbilisi",
  district: "Vake",
  address: "Main 1",
  price: 100,
  currency: "USD",
  area: 50,
  rooms: 2,
  floor: null,
  floors: null,
  condition: null,
  verified: false,
  agent: null,
  images: [],
  owner: { phone: "+995" },
  updatedAt: new Date("2026-11-06T10:00:00Z"),
};

beforeEach(() => vi.resetAllMocks());

describe("setFavorite", () => {
  it("removes when asked, and removing twice is harmless", async () => {
    await setFavorite("u1", 7, false);
    expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", listingId: 7 } });
    expect(prisma.favorite.createMany).not.toHaveBeenCalled();
  });

  it("adds a published listing, and adding twice is harmless", async () => {
    prisma.listing.findFirst.mockResolvedValue({ id: 7 });
    await setFavorite("u1", 7, true);
    expect(prisma.listing.findFirst.mock.calls[0][0].where).toEqual({ id: 7, status: "ACTIVE" });
    expect(prisma.favorite.createMany).toHaveBeenCalledWith({ data: [{ userId: "u1", listingId: 7 }], skipDuplicates: true });
    expect(prisma.favorite.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses an unpublished or unknown listing", async () => {
    prisma.listing.findFirst.mockResolvedValue(null);
    await setFavorite("u1", 7, true);
    expect(prisma.favorite.createMany).not.toHaveBeenCalled();
  });
});

describe("favourite lists", () => {
  it("returns the ids for one user", async () => {
    prisma.favorite.findMany.mockResolvedValue([{ listingId: 7 }, { listingId: 9 }]);
    expect(await getFavoriteIds("u1")).toEqual([7, 9]);
    expect(prisma.favorite.findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });
  });

  it("lists only that user's published favourites", async () => {
    prisma.favorite.findMany.mockResolvedValue([{ listing: row }]);
    expect((await listFavorites("u1")).map((l) => l.id)).toEqual([7]);
    expect(prisma.favorite.findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: "u1", listing: { status: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("my listings", () => {
  it("lists every status for the owner only", async () => {
    prisma.listing.findMany.mockResolvedValue([row]);
    const mine = await listMyListings("u1");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ status: "PENDING", listing: { id: 7 } });
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({ where: { ownerId: "u1" }, orderBy: { id: "desc" } });
  });

  it("can only archive the caller's own listing", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 1 });
    await archiveListing("u1", 7);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: 7, ownerId: "u1", status: { in: ["PENDING", "ACTIVE"] } },
      data: { status: "ARCHIVED" },
    });
  });
});

describe("parseListingId", () => {
  it("reads a valid id and rejects anything else", () => {
    expect(parseListingId("7")).toBe(7);
    expect(parseListingId("abc")).toBeNull();
    expect(parseListingId("2147483648")).toBeNull();
  });
});
