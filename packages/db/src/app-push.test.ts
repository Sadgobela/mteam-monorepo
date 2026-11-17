import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  appPushToken: { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { deleteAppPushToken, deleteExpiredAppPushTokens, listAppPushTargets, markAppPushTokensUsed, MAX_PUSH_SUBSCRIPTIONS, saveAppPushToken } from "./index";

const NOW = new Date("2026-11-17T10:00:00Z");
const token = "ExponentPushToken[abc]";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});
afterEach(() => vi.useRealTimers());

describe("saveAppPushToken", () => {
  it("saves the phone by its token, moving it to this user, and keeps within the limit", async () => {
    prisma.appPushToken.findMany.mockResolvedValue([]);
    await saveAppPushToken("u1", { token, locale: "en", platform: "ios" });
    const fields = { token, locale: "en", platform: "ios", userId: "u1", lastUsedAt: NOW };
    expect(prisma.appPushToken.upsert).toHaveBeenCalledWith({ where: { token }, create: fields, update: fields });
    expect(prisma.appPushToken.findMany).toHaveBeenCalledWith({ where: { userId: "u1" }, orderBy: { lastUsedAt: "desc" }, skip: MAX_PUSH_SUBSCRIPTIONS, select: { id: true } });
    expect(prisma.appPushToken.deleteMany).not.toHaveBeenCalled();
  });

  it("drops the phones used longest ago once over the limit", async () => {
    prisma.appPushToken.findMany.mockResolvedValue([{ id: "old" }]);
    await saveAppPushToken("u1", { token, locale: "ka", platform: "android" });
    expect(prisma.appPushToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["old"] } } });
  });
});

describe("reading and removing", () => {
  it("removes only the user's own phone", async () => {
    await deleteAppPushToken("u1", token);
    expect(prisma.appPushToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", token } });
  });

  it("sends only to users who keep push on", async () => {
    prisma.appPushToken.findMany.mockResolvedValue([{ token, locale: "ka" }]);
    expect(await listAppPushTargets("u1")).toEqual([{ token, locale: "ka" }]);
    expect(prisma.appPushToken.findMany).toHaveBeenCalledWith({ where: { userId: "u1", user: { notifyPush: true } }, select: { token: true, locale: true } });
  });

  it("forgets phones that are gone and records deliveries", async () => {
    await deleteExpiredAppPushTokens(["a"]);
    expect(prisma.appPushToken.deleteMany).toHaveBeenCalledWith({ where: { token: { in: ["a"] } } });
    await markAppPushTokensUsed(["b"]);
    expect(prisma.appPushToken.updateMany).toHaveBeenCalledWith({ where: { token: { in: ["b"] } }, data: { lastUsedAt: NOW } });
  });
});
