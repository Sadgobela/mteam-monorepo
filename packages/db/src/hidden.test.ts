import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ hiddenListing: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() } }));

vi.mock("./client", () => ({ db: () => prisma }));

import { getHiddenIds, setHidden } from "./hidden";

beforeEach(() => vi.clearAllMocks());

describe("hidden listings", () => {
  it("hides a listing, tolerating a repeat", async () => {
    await setHidden("u1", 7, true);
    expect(prisma.hiddenListing.createMany).toHaveBeenCalledWith({ data: [{ userId: "u1", listingId: 7 }], skipDuplicates: true });
  });

  it("shows it again", async () => {
    await setHidden("u1", 7, false);
    expect(prisma.hiddenListing.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", listingId: 7 } });
  });

  it("lists a user's hidden ids", async () => {
    prisma.hiddenListing.findMany.mockResolvedValue([{ listingId: 7 }, { listingId: 9 }]);
    expect(await getHiddenIds("u1")).toEqual([7, 9]);
  });
});
