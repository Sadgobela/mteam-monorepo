import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ agent: { findMany: vi.fn(), findFirst: vi.fn() }, branch: { findMany: vi.fn(), findFirst: vi.fn() }, listing: { findMany: vi.fn() } }));

vi.mock("./client", () => ({ db: () => prisma }));

import { getBranch, getBroker, listBranches, listBrokers } from "./index";

const named = { id: "a1", user: { name: "Nino", phone: "+995" }, branch: { name: "Vake" } };
const unnamed = { id: "a2", user: { name: null, phone: "+996" }, branch: null };
const listing = { id: 7, deal: "SALE", type: "APARTMENT", agent: null, images: [], owner: { phone: "+995" }, updatedAt: new Date("2026-11-06T10:00:00Z") };

beforeEach(() => vi.resetAllMocks());

const publicBroker = { user: { name: { not: null }, role: "AGENT" } };

describe("listBranches", () => {
  it("adds up each branch's public brokers and their live listings", async () => {
    prisma.branch.findMany.mockResolvedValue([{ id: "b1", name: "Vake", city: "Tbilisi", agents: [{ _count: { listings: 2 } }, { _count: { listings: 3 } }] }]);
    expect(await listBranches()).toEqual([{ id: "b1", name: "Vake", city: "Tbilisi", brokerCount: 2, listingCount: 5 }]);
    const query = prisma.branch.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ agents: { some: publicBroker } });
    expect(query.select.agents.where).toEqual(publicBroker);
  });
});

describe("getBranch", () => {
  it("returns the branch's brokers and only their published listings", async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: "b1", name: "Vake", city: "Tbilisi", agents: [{ ...named, _count: { listings: 1 } }] });
    prisma.listing.findMany.mockResolvedValue([listing]);
    const branch = await getBranch("b1");
    expect(branch?.brokers).toEqual([{ id: "a1", name: "Nino", branch: "Vake", phone: "+995", listingCount: 1 }]);
    expect(branch?.listings.map((item) => item.id)).toEqual([7]);
    expect(prisma.listing.findMany.mock.calls[0][0].where).toEqual({ status: "ACTIVE", agent: { branchId: "b1", ...publicBroker } });
  });

  it("finds nothing for an empty branch or a malformed id", async () => {
    prisma.branch.findFirst.mockResolvedValue(null);
    expect(await getBranch("b1")).toBeNull();
    expect(await getBranch("bad id")).toBeNull();
    expect(prisma.branch.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe("listBrokers", () => {
  it("returns named brokers with their published listing count", async () => {
    prisma.agent.findMany.mockResolvedValue([{ ...named, _count: { listings: 3 } }, { ...unnamed, _count: { listings: 0 } }]);
    expect(await listBrokers()).toEqual([
      { id: "a1", name: "Nino", branch: "Vake", phone: "+995", listingCount: 3 },
      { id: "a2", name: "", branch: "", phone: "+996", listingCount: 0 },
    ]);
    const args = prisma.agent.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ user: { name: { not: null }, role: "AGENT" } });
    expect(args.include._count.select.listings.where).toEqual({ status: "ACTIVE" });
  });
});

describe("getBroker", () => {
  it("returns a named broker and only published listings", async () => {
    prisma.agent.findFirst.mockResolvedValue({ ...named, listings: [listing] });
    const broker = await getBroker("a1");
    expect(broker).toMatchObject({ id: "a1", name: "Nino", branch: "Vake", phone: "+995" });
    expect(broker?.listings.map((l) => l.id)).toEqual([7]);
    const args = prisma.agent.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ id: "a1", user: { name: { not: null }, role: "AGENT" } });
    expect(args.include.listings.where).toEqual({ status: "ACTIVE" });
  });

  it("copes with missing name and branch values", async () => {
    prisma.agent.findFirst.mockResolvedValue({ ...unnamed, listings: [] });
    expect(await getBroker("a2")).toMatchObject({ name: "", branch: "" });
  });

  it("is null for an unknown broker", async () => {
    prisma.agent.findFirst.mockResolvedValue(null);
    expect(await getBroker("a9")).toBeNull();
  });

  it.each(["a b", "", "x".repeat(41), "a\u0000"])("rejects id %j without querying", async (id) => {
    expect(await getBroker(id)).toBeNull();
    expect(prisma.agent.findFirst).not.toHaveBeenCalled();
  });
});
