import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), updateMany: vi.fn() },
  lead: { findMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));
const notices = vi.hoisted(() => ({ notifyListingReviewed: vi.fn() }));
vi.mock("./notifications", () => notices);

import {
  listOpenLeads,
  listPendingListings,
  listUnverifiedListings,
  markLeadContacted,
  reviewListing,
  verifyListing,
} from "./index";
import { promoteUser } from "./roles";

const row = {
  id: 7,
  deal: "SALE",
  type: "APARTMENT",
  title: "Flat",
  agent: null,
  images: [],
  owner: { phone: "+995" },
  updatedAt: new Date("2026-11-06T10:00:00Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now: new Date("2026-11-09T10:00:00Z") });
});

afterEach(() => vi.useRealTimers());

describe("moderation queue", () => {
  const seen = new Date("2026-11-06T10:00:00.123Z");
  const applies = () => prisma.listing.updateMany.mockResolvedValue({ count: 1 });

  it("lists pending listings oldest first, with the exact time each last changed", async () => {
    prisma.listing.findMany.mockResolvedValue([{ ...row, updatedAt: seen }]);
    expect((await listPendingListings()).map((l) => [l.id, l.editedAt])).toEqual([[7, "2026-11-06T10:00:00.123Z"]]);
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({ where: { status: "PENDING" }, orderBy: [{ sourceRef: { sort: "asc", nulls: "first" } }, { id: "asc" }] });
  });

  it.each(["ACTIVE", "REJECTED"] as const)("only moves a listing that is still pending and unchanged to %s", async (decision) => {
    applies();
    expect(await reviewListing(7, decision, seen)).toBe(true);
    expect(prisma.listing.updateMany).toHaveBeenLastCalledWith({ where: { id: 7, status: "PENDING", updatedAt: seen }, data: { status: decision } });
    expect(notices.notifyListingReviewed).toHaveBeenCalledWith(7, decision);
  });

  it("leaves a listing edited since it was seen pending, and tells nobody", async () => {
    prisma.listing.updateMany.mockResolvedValue({ count: 0 });
    expect(await reviewListing(7, "ACTIVE", seen)).toBe(false);
    expect(notices.notifyListingReviewed).not.toHaveBeenCalled();
  });

  it("starts an owner's 60 days on approval, and never a broker's", async () => {
    const now = new Date("2026-11-16T00:00:00Z");
    prisma.listing.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await reviewListing(7, "ACTIVE", seen, now)).toBe(true);
    expect(notices.notifyListingReviewed).toHaveBeenCalled();
    expect(prisma.listing.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 7, status: "PENDING", updatedAt: seen, agentId: null },
      data: { status: "ACTIVE", expiresAt: new Date("2027-01-15T00:00:00Z") },
    });
  });

  it("sets no end date on a rejection", async () => {
    applies();
    await reviewListing(7, "REJECTED", seen);
    expect(prisma.listing.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("verification", () => {
  it("lists published, unchecked listings", async () => {
    prisma.listing.findMany.mockResolvedValue([row]);
    await listUnverifiedListings();
    expect(prisma.listing.findMany.mock.calls[0][0].where).toEqual({ status: "ACTIVE", verified: false });
  });

  it("records who checked a listing and when", async () => {
    await verifyListing("a1", 7);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: 7, status: "ACTIVE", verified: false },
      data: { verified: true, verifiedAt: new Date("2026-11-09T10:00:00Z"), verifiedById: "a1" },
    });
  });
});

describe("leads", () => {
  it("lists open leads, newest first", async () => {
    prisma.lead.findMany.mockResolvedValue([{ id: "l1" }]);
    expect(await listOpenLeads()).toEqual([{ id: "l1" }]);
    expect(prisma.lead.findMany.mock.calls[0][0]).toMatchObject({
      where: { status: { in: ["NEW", "CONTACTED"] } },
      select: { listingId: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("only moves a new lead to contacted", async () => {
    await markLeadContacted("l1");
    expect(prisma.lead.updateMany).toHaveBeenCalledWith({ where: { id: "l1", status: "NEW" }, data: { status: "CONTACTED" } });
  });
});

describe("promoteUser", () => {
  const fake = () => ({
    user: { update: vi.fn().mockResolvedValue({ id: "u1" }) },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn(async (writes: Promise<unknown>[]) => Promise.all(writes)),
  });
  const staffWrite = { upsert: { create: {}, update: {} } };

  it.each(["AGENT", "ADMIN"])("makes %s a broker record in the same write", async (role) => {
    const client = fake();
    await promoteUser(client as unknown as PrismaClient, "+995", role);
    expect(client.user.update).toHaveBeenCalledWith({ where: { phone: "+995" }, data: { role, name: undefined, agent: staffWrite } });
  });

  it("can set the name shown on the broker's profile", async () => {
    const client = fake();
    await promoteUser(client as unknown as PrismaClient, "+995", "AGENT", "Nino");
    expect(client.user.update.mock.calls[0][0].data.name).toBe("Nino");
  });

  it("leaves a broker's chats alone while they stay one", async () => {
    const client = fake();
    await promoteUser(client as unknown as PrismaClient, "+995", "AGENT");
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(client.$executeRaw).not.toHaveBeenCalled();
  });

  it.each(["USER", "ADMIN"])("hands a former broker's chats to the owners when they become %s, in one write", async (role) => {
    const client = fake();
    await promoteUser(client as unknown as PrismaClient, "+995", role);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.$executeRaw.mock.calls[0].slice(1)).toEqual(["+995"]);
  });

  it("creates no broker record for an ordinary user", async () => {
    const client = fake();
    await promoteUser(client as unknown as PrismaClient, "+995", "USER");
    expect(client.user.update.mock.calls[0][0].data.agent).toBeUndefined();
  });

  it("rejects an unknown role before writing", async () => {
    const client = fake();
    await expect(promoteUser(client as unknown as PrismaClient, "+995", "ROOT")).rejects.toThrow();
    expect(client.user.update).not.toHaveBeenCalled();
  });
});
