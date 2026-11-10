import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  savedSearch: { count: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  listing: { count: vi.fn(), fields: { floors: "FLOORS" } },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { deleteSavedSearch, isSearchSaved, listSavedSearches, openSavedSearch, saveSearch } from "./index";

beforeEach(() => vi.resetAllMocks());

describe("saveSearch", () => {
  it("keeps a search, tolerating a repeat", async () => {
    prisma.savedSearch.count.mockResolvedValue(0);
    expect(await saveSearch("u1", "deal=sale")).toBe(true);
    expect(prisma.savedSearch.createMany).toHaveBeenCalledWith({ data: [{ userId: "u1", query: "deal=sale" }], skipDuplicates: true });
  });

  it("stops at the limit", async () => {
    prisma.savedSearch.count.mockResolvedValue(30);
    expect(await saveSearch("u1", "deal=sale")).toBe(false);
    expect(prisma.savedSearch.createMany).not.toHaveBeenCalled();
  });
});

describe("isSearchSaved", () => {
  it("looks only at this user's searches", async () => {
    prisma.savedSearch.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect(await isSearchSaved("u1", "deal=sale")).toBe(true);
    expect(await isSearchSaved("u1", "deal=rent")).toBe(false);
    expect(prisma.savedSearch.count.mock.calls[0][0].where).toEqual({ userId: "u1", query: "deal=sale" });
  });
});

describe("deleteSavedSearch", () => {
  it("checks the owner in the write", async () => {
    await deleteSavedSearch("u1", "s1");
    expect(prisma.savedSearch.deleteMany).toHaveBeenCalledWith({ where: { id: "s1", userId: "u1" } });
  });
});

describe("listSavedSearches", () => {
  it("reads each search and counts what is new since it was opened", async () => {
    const seenAt = new Date("2026-11-01");
    prisma.savedSearch.findMany.mockResolvedValue([{ id: "s1", query: "deal=sale", seenAt }]);
    prisma.listing.count.mockResolvedValue(4);
    expect(await listSavedSearches("u1")).toEqual([{ id: "s1", query: "deal=sale", filters: expect.objectContaining({ deal: "sale" }), newCount: 4 }]);
    expect(prisma.listing.count.mock.calls[0][0].where).toMatchObject({ status: "ACTIVE", deal: "SALE", createdAt: { gt: seenAt } });
  });
});

describe("openSavedSearch", () => {
  it("marks it seen and gives its parameters", async () => {
    prisma.savedSearch.updateMany.mockResolvedValue({ count: 1 });
    prisma.savedSearch.findFirst.mockResolvedValue({ query: "deal=sale" });
    expect(await openSavedSearch("u1", "s1")).toBe("deal=sale");
    expect(prisma.savedSearch.updateMany.mock.calls[0][0].where).toEqual({ id: "s1", userId: "u1" });
  });

  it("gives nothing for someone else's search, or one removed meanwhile", async () => {
    prisma.savedSearch.updateMany.mockResolvedValue({ count: 0 });
    expect(await openSavedSearch("u1", "s1")).toBeNull();
    prisma.savedSearch.updateMany.mockResolvedValue({ count: 1 });
    prisma.savedSearch.findFirst.mockResolvedValue(null);
    expect(await openSavedSearch("u1", "s1")).toBeNull();
  });
});
