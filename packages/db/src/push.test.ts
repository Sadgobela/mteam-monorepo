import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  pushSubscription: { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { deleteExpiredPushSubscriptions, deletePushSubscription, listPushEndpoints, listPushTargets, markPushSubscriptionsUsed, MAX_PUSH_SUBSCRIPTIONS, savePushSubscription } from "./index";

const NOW = new Date("2026-11-17T10:00:00Z");
const target = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "key", auth: "secret", locale: "en" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});
afterEach(() => vi.useRealTimers());

describe("savePushSubscription", () => {
  it("saves the browser by its address, moving it to this user, and keeps within the limit", async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([]);
    await savePushSubscription("u1", { ...target, userAgent: "Safari" });
    const fields = { ...target, userAgent: "Safari", userId: "u1", lastUsedAt: NOW };
    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({ where: { endpoint: target.endpoint }, create: fields, update: fields });
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: "u1" }, orderBy: { lastUsedAt: "desc" }, skip: MAX_PUSH_SUBSCRIPTIONS, select: { id: true } });
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it("drops the browsers used longest ago once over the limit", async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([{ id: "old1" }, { id: "old2" }]);
    await savePushSubscription("u1", { ...target, userAgent: null });
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["old1", "old2"] } } });
  });
});

describe("reading and removing", () => {
  it("removes only the user's own browser", async () => {
    await deletePushSubscription("u1", target.endpoint);
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", endpoint: target.endpoint } });
  });

  it("lists the user's browser addresses", async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([{ endpoint: "a" }, { endpoint: "b" }]);
    expect(await listPushEndpoints("u1")).toEqual(["a", "b"]);
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: "u1" }, select: { endpoint: true } });
  });

  it("sends only to users who keep push on", async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([target]);
    expect(await listPushTargets("u1")).toEqual([target]);
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: "u1", user: { notifyPush: true } }, select: { endpoint: true, p256dh: true, auth: true, locale: true } });
  });

  it("forgets browsers that are gone and records deliveries", async () => {
    await deleteExpiredPushSubscriptions(["a"]);
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: { in: ["a"] } } });
    await markPushSubscriptionsUsed(["b"]);
    expect(prisma.pushSubscription.updateMany).toHaveBeenCalledWith({ where: { endpoint: { in: ["b"] } }, data: { lastUsedAt: NOW } });
  });
});
