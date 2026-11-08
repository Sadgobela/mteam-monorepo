import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), updateMany: vi.fn() },
  lead: { findMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

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
  it("lists pending listings oldest first", async () => {
    prisma.listing.findMany.mockResolvedValue([row]);
    expect((await listPendingListings()).map((l) => l.id)).toEqual([7]);
    expect(prisma.listing.findMany.mock.calls[0][0]).toMatchObject({ where: { status: "PENDING" }, orderBy: { id: "asc" } });
  });

  it.each(["ACTIVE", "REJECTED"] as const)("only moves a listing that is still pending to %s", async (decision) => {
    await reviewListing(7, decision);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({ where: { id: 7, status: "PENDING" }, data: { status: decision } });
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
    agent: { upsert: vi.fn() },
  });

  it.each(["AGENT", "ADMIN"])("makes %s a broker record too", async (role) => {
    const client = fake();
    await promoteUser(client as unknown as PrismaClient, "+995", role);
    expect(client.user.update).toHaveBeenCalledWith({ where: { phone: "+995" }, data: { role } });
    expect(client.agent.upsert).toHaveBeenCalledWith({ where: { userId: "u1" }, update: {}, create: { userId: "u1" } });
  });

  it("creates no broker record for an ordinary user", async () => {
    const client = fake();
    await promoteUser(client as unknown as PrismaClient, "+995", "USER");
    expect(client.agent.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown role before writing", async () => {
    const client = fake();
    await expect(promoteUser(client as unknown as PrismaClient, "+995", "ROOT")).rejects.toThrow();
    expect(client.user.update).not.toHaveBeenCalled();
  });
});
