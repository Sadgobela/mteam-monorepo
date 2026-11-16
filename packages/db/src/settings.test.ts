import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => {
  const client = {
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    session: { findMany: vi.fn(), deleteMany: vi.fn() },
    identity: { deleteMany: vi.fn() },
    savedSearch: { deleteMany: vi.fn() },
    favorite: { deleteMany: vi.fn() },
    hiddenListing: { deleteMany: vi.fn() },
    emailToken: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    pushSubscription: { deleteMany: vi.fn() },
    agent: { updateMany: vi.fn() },
    listing: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(async (work: (tx: typeof client) => Promise<unknown>) => work(client));
  return client;
});

vi.mock("./client", () => ({ db: () => prisma }));

import { deleteAccount, getPreferences, listDevices, setPreference, signOutDevice, signOutOtherDevices } from "./index";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-11-16T10:00:00Z") });
});

afterEach(() => vi.useRealTimers());

describe("preferences", () => {
  it("reads all six switches of the user", async () => {
    const stored = { notifyMessages: true, notifySavedSearches: false, notifyPriceDrops: true, notifyListingUpdates: true, notifyPush: true, hidePhoneDefault: false };
    prisma.user.findUniqueOrThrow.mockResolvedValue(stored);
    expect(await getPreferences("u1")).toEqual(stored);
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { notifyMessages: true, notifySavedSearches: true, notifyPriceDrops: true, notifyListingUpdates: true, notifyPush: true, hidePhoneDefault: true },
    });
  });

  it("changes one switch on the user's own row", async () => {
    await setPreference("u1", "hidePhoneDefault", true);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { hidePhoneDefault: true } });
  });
});

describe("devices", () => {
  it("lists live sessions, most recent first, marking this one and falling back to sign-in time", async () => {
    const seen = new Date("2026-11-16T09:00:00Z");
    const created = new Date("2026-11-01T09:00:00Z");
    prisma.session.findMany.mockResolvedValue([
      { tokenHash: sha256("mine"), userAgent: "Chrome", lastSeenAt: seen, createdAt: created },
      { tokenHash: "other", userAgent: null, lastSeenAt: null, createdAt: created },
    ]);
    expect(await listDevices("u1", "mine")).toEqual([
      { id: sha256("mine"), userAgent: "Chrome", lastSeenAt: seen, current: true },
      { id: "other", userAgent: null, lastSeenAt: created, current: false },
    ]);
    const query = prisma.session.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ userId: "u1", expiresAt: { gt: new Date("2026-11-16T10:00:00Z") } });
    expect(query.orderBy).toEqual([{ lastSeenAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]);
  });

  it("signs out one device only if it is the user's and not this one", async () => {
    await signOutDevice("u1", "abc", "mine");
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", tokenHash: { equals: "abc", not: sha256("mine") } } });
  });

  it("signs out every other device of the user", async () => {
    await signOutOtherDevices("u1", "mine");
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", tokenHash: { not: sha256("mine") } } });
  });
});

describe("deleteAccount", () => {
  it("clears personal details, removes sign-ins, saved things and push subscriptions, and archives listings, in one transaction", async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    expect(await deleteAccount("u1")).toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", role: "USER" },
      data: { name: null, phone: null, email: null, emailVerifiedAt: null, passwordHash: null, avatarUrl: null, deletedAt: expect.any(Date) },
    });
    for (const table of [prisma.identity, prisma.session, prisma.savedSearch, prisma.favorite, prisma.hiddenListing, prisma.emailToken, prisma.notification, prisma.pushSubscription]) {
      expect(table.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    }
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({ where: { ownerId: "u1", status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
    expect(prisma.agent.updateMany).toHaveBeenCalledWith({ where: { userId: "u1" }, data: { photoUrl: null, bio: null } });
  });

  it("refuses brokers and admins, changing nothing", async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    expect(await deleteAccount("staff")).toBe(false);
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(prisma.listing.updateMany).not.toHaveBeenCalled();
  });
});
