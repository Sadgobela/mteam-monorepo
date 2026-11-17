// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedNotification } from "@mteam/db";

const db = vi.hoisted(() => ({ listAppPushTargets: vi.fn(), deleteExpiredAppPushTokens: vi.fn(), markAppPushTokensUsed: vi.fn(), onNotificationsCreated: vi.fn() }));
vi.mock("@mteam/db", () => db);

import { deliverToApps, expoPushTokenSchema } from "./app-push";

const message: CreatedNotification = { id: "n1", userId: "u1", listingId: 7, listingTitle: "Flat in Vake", type: "MESSAGE", conversationId: "c1", count: 2 };
const fetchMock = vi.fn();
const answer = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("expoPushTokenSchema", () => {
  it("takes Expo's token shapes only", () => {
    expect(expoPushTokenSchema.safeParse("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]").success).toBe(true);
    expect(expoPushTokenSchema.safeParse("ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]").success).toBe(true);
    expect(expoPushTokenSchema.safeParse("https://evil.test").success).toBe(false);
  });
});

describe("deliverToApps", () => {
  it("sends each phone the message in its language, forgets the gone ones and logs other failures", async () => {
    db.listAppPushTargets.mockResolvedValue([
      { token: "t-en", locale: "en" },
      { token: "t-ka", locale: "ka" },
      { token: "t-bad", locale: "en" },
    ]);
    fetchMock.mockResolvedValue(
      answer({ data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }, { status: "error", details: { error: "MessageRateExceeded" } }, { status: "ok" }] }),
    );
    await deliverToApps([message]);
    expect(db.listAppPushTargets).toHaveBeenCalledWith("u1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(init.headers).not.toHaveProperty("authorization");
    const sent = JSON.parse(init.body);
    expect(sent[0]).toEqual({ to: "t-en", title: "Flat in Vake", body: "New messages: 2", data: { url: "/en/messages/c1", tag: "n1" }, sound: "default", ttl: 86_400 });
    expect(sent[1].body).toBe("ახალი წერილი: 2");
    expect(db.deleteExpiredAppPushTokens).toHaveBeenCalledWith(["t-ka"]);
    expect(db.markAppPushTokensUsed).toHaveBeenCalledWith(["t-en"]);
    expect(console.error).toHaveBeenCalledWith("app push: MessageRateExceeded");
  });

  it("sends the access token when the project has one, and logs an error without details", async () => {
    vi.stubEnv("EXPO_ACCESS_TOKEN", "secret");
    db.listAppPushTargets.mockResolvedValue([{ token: "t1", locale: "en" }]);
    fetchMock.mockResolvedValue(answer({ data: [{ status: "error" }] }));
    await deliverToApps([message]);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer secret");
    expect(console.error).toHaveBeenCalledWith("app push: error");
    expect(db.deleteExpiredAppPushTokens).not.toHaveBeenCalled();
    expect(db.markAppPushTokensUsed).not.toHaveBeenCalled();
  });

  it("skips users without phones, and moves on when Expo refuses", async () => {
    db.listAppPushTargets.mockResolvedValueOnce([]).mockResolvedValueOnce([{ token: "t1", locale: "en" }]).mockResolvedValueOnce([{ token: "t2", locale: "en" }]);
    fetchMock.mockResolvedValueOnce(answer(null, false, 503)).mockResolvedValueOnce(answer({ data: [{ status: "ok" }] }));
    await deliverToApps([message, { ...message, userId: "u2" }, { ...message, userId: "u3" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith("app push: Expo answered 503");
    expect(db.markAppPushTokensUsed).toHaveBeenCalledWith(["t2"]);
  });
});
