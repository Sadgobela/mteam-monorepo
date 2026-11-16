import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { archiveExpiredListings, bumpListing, countMyListings, deleteDraft, countPhoneReveal, expiryFrom, listMyListingsTab, renewListing } from "./index";

const now = new Date("2026-11-16T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

const row = {
  id: 7,
  status: "ACTIVE",
  deal: "SALE",
  type: "APARTMENT",
  title: "Flat",
  description: "Sunny",
  city: "Tbilisi",
  district: "Vake",
  address: "Main 1",
  price: 100000,
  currency: "USD",
  area: 50,
  features: [],
  verified: false,
  agent: null,
  agentId: null,
  images: [{ url: "https://cdn/a.jpg" }],
  owner: { phone: "+995" },
  ownerId: "u1",
  views: 40,
  phoneReveals: 3,
  marketLevel: 2,
  expiresAt: new Date("2026-11-20T00:00:00Z"),
  bumpedAt: null,
  _count: { favorites: 5, conversations: 2 },
  updatedAt: now,
};

beforeEach(() => vi.resetAllMocks());

describe("expiryFrom", () => {
  it("is 60 days on", () => {
    expect(expiryFrom(now)).toEqual(new Date("2027-01-15T12:00:00Z"));
  });
});

describe("countMyListings", () => {
  it("counts each tab, expiring soon among the published, and zero for an empty status", async () => {
    prisma.listing.groupBy.mockResolvedValue([
      { status: "ACTIVE", _count: { _all: 4 } },
      { status: "PENDING", _count: { _all: 1 } },
      { status: "ARCHIVED", _count: { _all: 2 } },
    ]);
    prisma.listing.count.mockResolvedValue(1);
    expect(await countMyListings("u1", now)).toEqual({ active: 4, pending: 1, draft: 0, expiring: 1, archived: 2, rejected: 0 });
    expect(prisma.listing.groupBy).toHaveBeenCalledWith({ by: ["status"], where: { ownerId: "u1" }, _count: { _all: true } });
    expect(prisma.listing.count).toHaveBeenCalledWith({
      where: { ownerId: "u1", status: "ACTIVE", agentId: null, expiresAt: { gt: now, lte: new Date("2026-11-23T12:00:00Z") } },
    });
  });

  it("uses the current time by default", async () => {
    prisma.listing.groupBy.mockResolvedValue([]);
    prisma.listing.count.mockResolvedValue(0);
    expect((await countMyListings("u1")).active).toBe(0);
  });
});

describe("listMyListingsTab", () => {
  const where = () => prisma.listing.findMany.mock.calls[0][0].where;

  it("shows only the user's own listings, with their numbers", async () => {
    prisma.listing.findMany.mockResolvedValue([row]);
    const [mine] = await listMyListingsTab("u1", { tab: "active" }, now);
    expect(where()).toEqual({ status: "ACTIVE", ownerId: "u1", OR: undefined });
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({ orderBy: [{ id: "desc" }], take: 100 });
    expect(mine).toMatchObject({
      status: "ACTIVE",
      views: 40,
      phoneReveals: 3,
      favorites: 5,
      conversations: 2,
      expiresAt: row.expiresAt,
      canRenew: true,
      canBump: true,
      nextBumpAt: undefined,
    });
    expect(mine.listing).toMatchObject({ id: 7, title: "Flat", marketLevel: 2, images: ["https://cdn/a.jpg"] });
  });

  it.each([
    ["pending", { status: "PENDING" }],
    ["draft", { status: "DRAFT" }],
    ["archived", { status: "ARCHIVED" }],
    ["rejected", { status: "REJECTED" }],
    ["expiring", { status: "ACTIVE", agentId: null, expiresAt: { gt: now, lte: new Date("2026-11-23T12:00:00Z") } }],
  ] as const)("filters the %s tab", async (tab, expected) => {
    prisma.listing.findMany.mockResolvedValue([]);
    await listMyListingsTab("u1", { tab }, now);
    expect(where()).toMatchObject({ ...expected, ownerId: "u1" });
  });

  it.each([
    ["asc", [{ priceUsd: "asc" }, { id: "desc" }]],
    ["desc", [{ priceUsd: "desc" }, { id: "desc" }]],
  ] as const)("sorts by price %s", async (sort, orderBy) => {
    prisma.listing.findMany.mockResolvedValue([]);
    await listMyListingsTab("u1", { tab: "active", sort }, now);
    expect(prisma.listing.findMany.mock.calls[0][0].orderBy).toEqual(orderBy);
  });

  it("finds by listing number or by words, with LIKE wildcards taken literally", async () => {
    prisma.listing.findMany.mockResolvedValue([]);
    await listMyListingsTab("u1", { tab: "active", q: "20418" });
    expect(where().OR).toContainEqual({ id: 20418 });
    prisma.listing.findMany.mockClear();
    await listMyListingsTab("u1", { tab: "active", q: "50%_off" });
    const words = where().OR;
    expect(words).toContainEqual({ title: { contains: "50\\%\\_off", mode: "insensitive" } });
    expect(words).not.toContainEqual(expect.objectContaining({ id: expect.anything() }));
  });

  it("says when a bumped listing can go up again", async () => {
    prisma.listing.findMany.mockResolvedValue([{ ...row, bumpedAt: hoursAgo(2) }, { ...row, id: 8, bumpedAt: hoursAgo(24) }]);
    const [recent, dayOld] = await listMyListingsTab("u1", { tab: "active" }, now);
    expect(recent).toMatchObject({ canBump: false, nextBumpAt: new Date("2026-11-17T10:00:00Z") });
    expect(dayOld).toMatchObject({ canBump: true, nextBumpAt: undefined });
  });

  it("offers renewal only for an owner's listing that is published or ran out", async () => {
    prisma.listing.findMany.mockResolvedValue([
      { ...row, id: 1, agentId: "a1", agent: { id: "a1", user: { name: "N", phone: "+995", role: "AGENT" }, branch: null } },
      { ...row, id: 2, status: "ARCHIVED", expiresAt: hoursAgo(1) },
      { ...row, id: 3, status: "ARCHIVED", expiresAt: null },
      { ...row, id: 4, status: "ARCHIVED", expiresAt: new Date("2027-01-01T00:00:00Z") },
      { ...row, id: 5, status: "PENDING", expiresAt: null },
      { ...row, id: 6, status: "ACTIVE", expiresAt: null },
    ]);
    const rows = await listMyListingsTab("u1", { tab: "active" }, now);
    expect(rows.map((mine) => mine.canRenew)).toEqual([false, true, false, false, false, true]);
    // The end date shows only on an owner's published listing that has one.
    expect(rows.map((mine) => mine.expiresAt)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
    expect(rows.map((mine) => mine.canBump)).toEqual([true, false, false, false, false, true]);
  });
});

describe("renewListing", () => {
  it("gives the user's own listing 60 more days and brings back one that ran out", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 1 });
    expect(await renewListing("u1", 7, now)).toBe(true);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: 7, ownerId: "u1", agentId: null, OR: [{ status: "ACTIVE" }, { status: "ARCHIVED", expiresAt: { lt: now } }] },
      data: { status: "ACTIVE", expiresAt: new Date("2027-01-15T12:00:00Z") },
    });
  });

  it("reports when nothing could be renewed", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 0 });
    expect(await renewListing("u2", 7)).toBe(false);
  });
});

describe("bumpListing", () => {
  it("bumps the user's published listing once a day", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 1 });
    expect(await bumpListing("u1", 7, now)).toBe(true);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: 7, ownerId: "u1", status: "ACTIVE", OR: [{ bumpedAt: null }, { bumpedAt: { lte: hoursAgo(24) } }] },
      data: { bumpedAt: now },
    });
  });

  it("reports a second bump the same day", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 0 });
    expect(await bumpListing("u1", 7)).toBe(false);
  });
});

describe("deleteDraft", () => {
  it("deletes only the user's own draft", async () => {
    prisma.listing.deleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteDraft("u1", 7)).toBe(true);
    expect(prisma.listing.deleteMany).toHaveBeenCalledWith({ where: { id: 7, ownerId: "u1", status: "DRAFT" } });
  });

  it("reports when there was no such draft", async () => {
    prisma.listing.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteDraft("u2", 7)).toBe(false);
  });
});

describe("archiveExpiredListings", () => {
  it("archives owners' published listings whose time has run out", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 3 });
    expect(await archiveExpiredListings(now)).toBe(3);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE", agentId: null, expiresAt: { lt: now } },
      data: { status: "ARCHIVED" },
    });
  });

  it("uses the current time by default", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 0 });
    expect(await archiveExpiredListings()).toBe(0);
  });
});

describe("countPhoneReveal", () => {
  it("counts a look at a published listing's visible number", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 1 });
    expect(await countPhoneReveal(7)).toBe(true);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: 7, status: "ACTIVE", hidePhone: false },
      data: { phoneReveals: { increment: 1 } },
    });
  });

  it("refuses a hidden number", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 0 });
    expect(await countPhoneReveal(7)).toBe(false);
  });
});
