import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { count: vi.fn() },
  notification: { count: vi.fn(), create: vi.fn(), createManyAndReturn: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  listing: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), fields: { floors: "FLOORS" } },
  listingPriceChange: { findMany: vi.fn() },
  favorite: { findMany: vi.fn() },
  savedSearch: { findMany: vi.fn() },
  hiddenListing: { findMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markConversationNotificationsRead,
  notifyListingReviewed,
  notifyMessage,
  onNotificationsCreated,
  openNotification,
  runNightlyNotifications,
} from "./index";

const NOW = new Date("2026-11-16T00:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
const daysAhead = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  prisma.notification.createManyAndReturn.mockImplementation(async ({ data }: { data: unknown[] }) => data.map((_, index) => ({ id: `new${index}` })));
  prisma.notification.create.mockResolvedValue({ id: "new" });
});
afterEach(() => {
  vi.useRealTimers();
  onNotificationsCreated(undefined);
});

describe("reading", () => {
  it("counts unread ones for the bell", async () => {
    prisma.notification.count.mockResolvedValue(4);
    expect(await countUnreadNotifications("u1")).toBe(4);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: "u1", readAt: null } });
  });

  it("lists newest first, reads each kind's data and drops rows that do not fit", async () => {
    const at = new Date("2026-11-15");
    const row = { id: "n", listingId: 7, conversationId: null, data: null, readAt: null, createdAt: at, listing: { title: "Flat" } };
    prisma.notification.findMany.mockResolvedValue([
      { ...row, id: "n1", type: "MESSAGE", conversationId: "c1", data: { count: 2 }, readAt: at },
      { ...row, id: "n2", type: "LISTING_APPROVED" },
      { ...row, id: "n3", type: "LISTING_EXPIRING", data: { expiresAt: "2026-11-18T00:00:00.000Z" } },
      { ...row, id: "n4", type: "PRICE_DROP", data: { oldPriceUsd: 100, newPriceUsd: 90 } },
      { ...row, id: "n5", type: "SEARCH_MATCHES", listingId: null, listing: null, data: { savedSearchId: "s1", query: "deal=sale", count: 3 } },
      { ...row, id: "n6", type: "PRICE_DROP", data: ["not", "an", "object"] },
      { ...row, id: "n7", type: "LISTING_APPROVED", data: { type: "SEARCH_MATCHES" }, listingId: null, listing: null },
    ]);
    expect(await listNotifications("u1")).toEqual([
      { id: "n1", type: "MESSAGE", conversationId: "c1", count: 2, read: true, at, listingId: 7, listingTitle: "Flat" },
      { id: "n2", type: "LISTING_APPROVED", read: false, at, listingId: 7, listingTitle: "Flat" },
      { id: "n3", type: "LISTING_EXPIRING", expiresAt: "2026-11-18T00:00:00.000Z", read: false, at, listingId: 7, listingTitle: "Flat" },
      { id: "n4", type: "PRICE_DROP", oldPriceUsd: 100, newPriceUsd: 90, read: false, at, listingId: 7, listingTitle: "Flat" },
      { id: "n5", type: "SEARCH_MATCHES", savedSearchId: "s1", query: "deal=sale", count: 3, read: false, at },
    ]);
    expect(prisma.notification.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: "u1" }, orderBy: { createdAt: "desc" }, take: 50 });
  });

  it("opens one of the user's own, marking it read", async () => {
    prisma.notification.findFirst.mockResolvedValue({ type: "LISTING_REJECTED", listingId: 7, conversationId: null, data: null, listing: { title: "Flat" } });
    expect(await openNotification("u1", "n1")).toEqual({ type: "LISTING_REJECTED", listingId: 7, listingTitle: "Flat" });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: "n1", userId: "u1", readAt: null }, data: { readAt: NOW } });
    expect(prisma.notification.findFirst.mock.calls[0][0].where).toEqual({ id: "n1", userId: "u1" });
  });

  it("opens nothing that is someone else's or does not fit", async () => {
    prisma.notification.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ type: "MESSAGE", listingId: 7, conversationId: null, data: {}, listing: { title: "Flat" } });
    expect(await openNotification("u1", "n1")).toBeNull();
    expect(await openNotification("u1", "n2")).toBeNull();
  });

  it("marks all, or one chat's, as read", async () => {
    await markAllNotificationsRead("u1");
    expect(prisma.notification.updateMany).toHaveBeenLastCalledWith({ where: { userId: "u1", readAt: null }, data: { readAt: NOW } });
    await markConversationNotificationsRead("u1", "c1");
    expect(prisma.notification.updateMany).toHaveBeenLastCalledWith({ where: { userId: "u1", readAt: null, type: "MESSAGE", conversationId: "c1" }, data: { readAt: NOW } });
  });
});

describe("notifyMessage", () => {
  it("starts one notification per chat", async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.notification.findFirst.mockResolvedValue(null);
    await notifyMessage("u2", "c1", 7);
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { id: "u2", notifyMessages: true } });
    expect(prisma.notification.findFirst.mock.calls[0][0].where).toEqual({ userId: "u2", readAt: null, type: "MESSAGE", conversationId: "c1" });
    expect(prisma.notification.create).toHaveBeenCalledWith({ data: { userId: "u2", type: "MESSAGE", conversationId: "c1", listingId: 7, data: { count: 1 } }, select: { id: true } });
  });

  it("counts up the unread one and moves it to the top, even if its count was lost", async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.notification.findFirst.mockResolvedValueOnce({ id: "n1", data: { count: 2 } }).mockResolvedValueOnce({ id: "n1", data: null });
    await notifyMessage("u2", "c1", 7);
    expect(prisma.notification.update).toHaveBeenLastCalledWith({ where: { id: "n1" }, data: { createdAt: NOW, data: { count: 3 } } });
    await notifyMessage("u2", "c1", 7);
    expect(prisma.notification.update).toHaveBeenLastCalledWith({ where: { id: "n1" }, data: { createdAt: NOW, data: { count: 2 } } });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("stays quiet for someone who turned message notifications off", async () => {
    prisma.user.count.mockResolvedValue(0);
    await notifyMessage("u2", "c1", 7);
    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
  });
});

describe("notifyListingReviewed", () => {
  const updatedAt = new Date("2026-11-15T12:00:00Z");

  it("tells the owner of an approval or a rejection once", async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.notification.count.mockResolvedValue(0);
    prisma.listing.findUnique.mockResolvedValue({ ownerId: "o1", status: "ACTIVE", updatedAt });
    await notifyListingReviewed(7, "ACTIVE");
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { id: "o1", notifyListingUpdates: true } });
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: "o1", createdAt: { gte: updatedAt }, type: "LISTING_APPROVED", listingId: 7 } });
    expect(prisma.notification.create).toHaveBeenLastCalledWith({ data: { userId: "o1", type: "LISTING_APPROVED", listingId: 7 }, select: { id: true } });

    prisma.listing.findUnique.mockResolvedValue({ ownerId: "o1", status: "REJECTED", updatedAt });
    await notifyListingReviewed(7, "REJECTED");
    expect(prisma.notification.create).toHaveBeenLastCalledWith({ data: { userId: "o1", type: "LISTING_REJECTED", listingId: 7 }, select: { id: true } });

    prisma.notification.count.mockResolvedValue(1);
    await notifyListingReviewed(7, "REJECTED");
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it("says nothing when the decision did not stick, the listing is gone or the owner opted out", async () => {
    prisma.listing.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ownerId: "o1", status: "PENDING", updatedAt });
    await notifyListingReviewed(7, "ACTIVE");
    await notifyListingReviewed(7, "ACTIVE");
    expect(prisma.user.count).not.toHaveBeenCalled();
    prisma.listing.findUnique.mockResolvedValue({ ownerId: "o1", status: "ACTIVE", updatedAt });
    prisma.user.count.mockResolvedValue(0);
    await notifyListingReviewed(7, "ACTIVE");
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe("runNightlyNotifications", () => {
  beforeEach(() => {
    prisma.listing.findMany.mockResolvedValue([]);
    prisma.listingPriceChange.findMany.mockResolvedValue([]);
    prisma.savedSearch.findMany.mockResolvedValue([]);
    prisma.notification.findMany.mockResolvedValue([]);
  });

  it("does nothing on a quiet night but clear out old read notifications", async () => {
    expect(await runNightlyNotifications()).toBe(0);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { readAt: { lt: new Date(NOW.getTime() - 90 * 86_400_000) } } });
    expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("warns owners of listings ending within three days, once per expiry date", async () => {
    prisma.listing.findMany.mockResolvedValue([
      { id: 1, ownerId: "o1", expiresAt: daysAhead(2) },
      { id: 2, ownerId: "o1", expiresAt: daysAhead(1) },
      { id: 3, ownerId: "o2", expiresAt: daysAhead(3) },
      { id: 4, ownerId: "o2", expiresAt: null },
    ]);
    prisma.notification.findMany.mockResolvedValue([
      { listingId: 2, createdAt: hoursAgo(20) }, // already told about this date
      { listingId: 3, createdAt: hoursAgo(70) }, // told before a renewal moved the date
    ]);
    expect(await runNightlyNotifications()).toBe(2);
    expect(prisma.listing.findMany.mock.calls[0][0].where).toEqual({ status: "ACTIVE", expiresAt: { gt: NOW, lte: daysAhead(3) }, owner: { notifyListingUpdates: true } });
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ userId: { in: ["o1", "o1", "o2", "o2"] }, createdAt: { gte: daysAhead(-3) }, type: "LISTING_EXPIRING", listingId: { in: [1, 2, 3, 4] } });
    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith({
      select: { id: true },
      data: [
        { userId: "o1", type: "LISTING_EXPIRING", listingId: 1, data: { expiresAt: daysAhead(2).toISOString() } },
        { userId: "o2", type: "LISTING_EXPIRING", listingId: 3, data: { expiresAt: daysAhead(3).toISOString() } },
      ],
    });
  });

  it("tells fans of a listing that got cheaper over the day, once per change", async () => {
    prisma.listingPriceChange.findMany.mockResolvedValue([
      { listingId: 1, oldPriceUsd: 100, newPriceUsd: 95, createdAt: hoursAgo(20) },
      { listingId: 1, oldPriceUsd: 95, newPriceUsd: 90, createdAt: hoursAgo(10) },
      { listingId: 2, oldPriceUsd: 100, newPriceUsd: 120, createdAt: hoursAgo(5) },
      { listingId: 3, oldPriceUsd: 200, newPriceUsd: 150, createdAt: hoursAgo(5) },
    ]);
    prisma.favorite.findMany.mockResolvedValue([
      { userId: "u1", listingId: 1 },
      { userId: "u2", listingId: 1 },
      { userId: "u1", listingId: 3 },
    ]);
    prisma.notification.findMany.mockResolvedValue([
      { userId: "u2", listingId: 1, createdAt: hoursAgo(15) }, // told before the second cut
      { userId: "u1", listingId: 3, createdAt: hoursAgo(1) }, // a second run on the same night
    ]);
    expect(await runNightlyNotifications()).toBe(2);
    expect(prisma.listingPriceChange.findMany.mock.calls[0][0].where).toEqual({ createdAt: { gte: hoursAgo(25) }, listing: { status: "ACTIVE" } });
    expect(prisma.favorite.findMany.mock.calls[0][0].where).toEqual({ listingId: { in: [1, 3] }, user: { notifyPriceDrops: true } });
    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith({
      select: { id: true },
      data: [
        { userId: "u1", type: "PRICE_DROP", listingId: 1, data: { oldPriceUsd: 100, newPriceUsd: 90 } },
        { userId: "u2", type: "PRICE_DROP", listingId: 1, data: { oldPriceUsd: 100, newPriceUsd: 90 } },
      ],
    });
  });

  it("skips price rises and listings nobody saved", async () => {
    prisma.listingPriceChange.findMany.mockResolvedValue([{ listingId: 2, oldPriceUsd: 100, newPriceUsd: 100, createdAt: hoursAgo(5) }]);
    expect(await runNightlyNotifications()).toBe(0);
    expect(prisma.favorite.findMany).not.toHaveBeenCalled();
    prisma.listingPriceChange.findMany.mockResolvedValue([{ listingId: 3, oldPriceUsd: 200, newPriceUsd: 150, createdAt: hoursAgo(5) }]);
    prisma.favorite.findMany.mockResolvedValue([]);
    expect(await runNightlyNotifications()).toBe(0);
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it("counts new matches for each saved search since the last run, or since it was opened if later", async () => {
    prisma.savedSearch.findMany.mockResolvedValue([
      { id: "s1", userId: "u1", query: "deal=sale", seenAt: hoursAgo(48) },
      { id: "s2", userId: "u1", query: "deal=rent", seenAt: hoursAgo(2) },
      { id: "s3", userId: "u2", query: "city=tbilisi", seenAt: hoursAgo(48) },
    ]);
    prisma.notification.findMany.mockResolvedValue([
      { createdAt: hoursAgo(1), data: { savedSearchId: "s3", query: "city=tbilisi", count: 2 } },
      { createdAt: hoursAgo(3), data: null },
    ]);
    prisma.hiddenListing.findMany.mockResolvedValueOnce([{ listingId: 9 }]).mockResolvedValueOnce([]);
    prisma.listing.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    expect(await runNightlyNotifications()).toBe(1);
    expect(prisma.savedSearch.findMany.mock.calls[0][0].where).toEqual({ user: { notifySavedSearches: true } });
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ userId: { in: ["u1", "u2"] }, createdAt: { gte: hoursAgo(25) }, type: "SEARCH_MATCHES" });
    const sinces = prisma.listing.count.mock.calls.map(([{ where }]) => where.createdAt.gt);
    expect(sinces).toEqual([hoursAgo(25), hoursAgo(2), hoursAgo(1)]);
    expect(prisma.listing.count.mock.calls[0][0].where).toMatchObject({ status: "ACTIVE", deal: "SALE", id: { notIn: [9] } });
    expect(prisma.hiddenListing.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith({ select: { id: true }, data: [{ userId: "u1", type: "SEARCH_MATCHES", data: { savedSearchId: "s1", query: "deal=sale", count: 3 } }] });
  });
});

describe("announcing new notifications", () => {
  const listener = vi.fn();
  const row = { id: "new", userId: "u2", type: "MESSAGE", listingId: 7, conversationId: "c1", data: { count: 1 }, listing: { title: "Flat" } };
  const created = { id: "new", userId: "u2", type: "MESSAGE", listingId: 7, listingTitle: "Flat", conversationId: "c1", count: 1 };

  beforeEach(() => {
    onNotificationsCreated(listener);
    prisma.user.count.mockResolvedValue(1);
  });

  it("hands a new chat notification to the listener, read back with its details, dropping rows that do not fit", async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.findMany.mockResolvedValue([row, { ...row, id: "broken", conversationId: null }]);
    await notifyMessage("u2", "c1", 7);
    expect(prisma.notification.findMany.mock.calls[0][0]).toMatchObject({ where: { id: { in: ["new"] } }, select: { id: true, userId: true, type: true } });
    expect(listener).toHaveBeenCalledWith([created]);
  });

  it("announces a chat notification again when another message bumps it", async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: "n1", data: { count: 1 } });
    prisma.notification.findMany.mockResolvedValue([{ ...row, id: "n1", data: { count: 2 } }]);
    await notifyMessage("u2", "c1", 7);
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["n1"] } });
    expect(listener).toHaveBeenCalledWith([{ ...created, id: "n1", count: 2 }]);
  });

  it("announces a review decision", async () => {
    prisma.notification.count.mockResolvedValue(0);
    prisma.listing.findUnique.mockResolvedValue({ ownerId: "o1", status: "ACTIVE", updatedAt: NOW });
    prisma.notification.findMany.mockResolvedValue([{ ...row, userId: "o1", type: "LISTING_APPROVED", conversationId: null, data: null }]);
    await notifyListingReviewed(7, "ACTIVE");
    expect(listener).toHaveBeenCalledWith([{ id: "new", userId: "o1", type: "LISTING_APPROVED", listingId: 7, listingTitle: "Flat" }]);
  });

  it("announces the nightly ones, and nothing on a quiet night", async () => {
    prisma.listingPriceChange.findMany.mockResolvedValue([]);
    prisma.savedSearch.findMany.mockResolvedValue([]);
    prisma.listing.findMany.mockResolvedValue([{ id: 7, ownerId: "o1", expiresAt: daysAhead(2) }]);
    const expiring = { ...row, id: "new0", userId: "o1", type: "LISTING_EXPIRING", conversationId: null, data: { expiresAt: daysAhead(2).toISOString() } };
    prisma.notification.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([expiring]);
    expect(await runNightlyNotifications()).toBe(1);
    expect(listener).toHaveBeenCalledWith([{ id: "new0", userId: "o1", type: "LISTING_EXPIRING", listingId: 7, listingTitle: "Flat", expiresAt: daysAhead(2).toISOString() }]);
    // Once every step and the clean-up are done, so slow delivery cannot cut the run short.
    expect(prisma.notification.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(listener.mock.invocationCallOrder[0]);

    listener.mockClear();
    prisma.listing.findMany.mockResolvedValue([]);
    expect(await runNightlyNotifications()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it("never lets a failed delivery fail the notification", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.findMany.mockResolvedValue([row]);
    listener.mockRejectedValue(new Error("push down"));
    await expect(notifyMessage("u2", "c1", 7)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(new Error("push down"));
  });
});
