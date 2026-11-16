// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedNotification } from "@mteam/db";

const db = vi.hoisted(() => ({ listPushTargets: vi.fn(), deleteExpiredPushSubscriptions: vi.fn(), markPushSubscriptionsUsed: vi.fn(), onNotificationsCreated: vi.fn() }));
const webpush = vi.hoisted(() => ({ sendNotification: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("web-push", () => ({ default: webpush }));

import { register } from "@/instrumentation";
import { pushMessage, registerPush, sendPush, vapidPublicKey } from "./push";

const env = { VAPID_PUBLIC_KEY: "public-key", VAPID_PRIVATE_KEY: "private-key", VAPID_SUBJECT: "mailto:team@example.test" };
const setUp = () => Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
const about = { id: "n1", userId: "u1", listingId: 7, listingTitle: "Flat in Vake" };
const message: CreatedNotification = { ...about, type: "MESSAGE", conversationId: "c1", count: 2 };
const target = (endpoint: string, locale = "en") => ({ endpoint, p256dh: "p256dh", auth: "auth", locale });
const failure = (statusCode: number) => Object.assign(new Error("push service"), { statusCode });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("set-up", () => {
  it("offers the public key only when all three keys are set and the contact is valid", () => {
    expect(vapidPublicKey()).toBeNull();
    setUp();
    expect(vapidPublicKey()).toBe("public-key");
    vi.stubEnv("VAPID_SUBJECT", "team@example.test");
    expect(vapidPublicKey()).toBeNull();
  });

  it("registers the sender with the notifications at start-up, on the Node.js server only", async () => {
    registerPush();
    expect(db.onNotificationsCreated).toHaveBeenCalledWith(sendPush);
    db.onNotificationsCreated.mockClear();
    await register();
    expect(db.onNotificationsCreated).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await register();
    expect(db.onNotificationsCreated).toHaveBeenCalledWith(sendPush);
  });
});

describe("pushMessage", () => {
  it.each<[CreatedNotification, string, string]>([
    [message, "New messages: 2", "/en/messages/c1"],
    [{ ...about, type: "LISTING_APPROVED" }, "Your listing is published", "/en/listings/7"],
    [{ ...about, type: "PRICE_DROP", oldPriceUsd: 100_000, newPriceUsd: 90_000 }, "A favourite got cheaper: $100,000 → $90,000", "/en/listings/7"],
    [{ ...about, type: "LISTING_REJECTED" }, "Your listing was not approved", "/en/my-listings"],
    [{ ...about, type: "LISTING_EXPIRING", expiresAt: "2026-11-20T10:00:00.000Z" }, "Your listing ends on", "/en/my-listings"],
  ])("writes %#: the listing as the title, the line as the body, and where to go", (notice, body, url) => {
    const pushed = pushMessage(notice, "en");
    expect(pushed.body).toContain(body);
    expect(pushed).toMatchObject({ title: "Flat in Vake", url, tag: "n1" });
  });

  it("names a saved search and opens its results", () => {
    const notice: CreatedNotification = { id: "n2", userId: "u1", type: "SEARCH_MATCHES", savedSearchId: "s1", query: "", count: 3 };
    expect(pushMessage(notice, "en")).toEqual({ title: "All listings", body: "New listings for your saved search: 3", url: "/en?", tag: "n2" });
  });

  it("writes in Georgian when the stored language is unknown", () => {
    expect(pushMessage(message, "de")).toMatchObject({ body: "ახალი წერილი: 2", url: "/ka/messages/c1" });
  });
});

describe("sendPush", () => {
  it("does nothing without VAPID keys", async () => {
    await sendPush([message]);
    expect(db.listPushTargets).not.toHaveBeenCalled();
  });

  it("sends to each of the user's browsers, forgets the gone ones and logs other failures", async () => {
    setUp();
    db.listPushTargets.mockResolvedValue([target("https://a.test"), target("https://b.test", "ka"), target("https://c.test"), target("https://d.test")]);
    webpush.sendNotification.mockResolvedValueOnce({ statusCode: 201 }).mockRejectedValueOnce(failure(410)).mockRejectedValueOnce(failure(404)).mockRejectedValueOnce(failure(500));
    await sendPush([message]);
    expect(db.listPushTargets).toHaveBeenCalledWith("u1");
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://a.test", keys: { p256dh: "p256dh", auth: "auth" } },
      JSON.stringify({ title: "Flat in Vake", body: "New messages: 2", url: "/en/messages/c1", tag: "n1" }),
      { vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: "public-key", privateKey: "private-key" }, TTL: 86_400, timeout: 10_000 },
    );
    expect(JSON.parse(webpush.sendNotification.mock.calls[1][1]).body).toBe("ახალი წერილი: 2");
    expect(db.deleteExpiredPushSubscriptions).toHaveBeenCalledWith(["https://b.test", "https://c.test"]);
    expect(db.markPushSubscriptionsUsed).toHaveBeenCalledWith(["https://a.test"]);
    expect(console.error).toHaveBeenCalledWith(failure(500));
  });

  it("writes nothing back when a user has no browsers, or none answered", async () => {
    setUp();
    db.listPushTargets.mockResolvedValueOnce([]).mockResolvedValueOnce([target("https://a.test")]);
    webpush.sendNotification.mockRejectedValue(new Error("offline"));
    await sendPush([message, { ...message, userId: "u2" }]);
    expect(db.listPushTargets).toHaveBeenCalledTimes(2);
    expect(db.deleteExpiredPushSubscriptions).not.toHaveBeenCalled();
    expect(db.markPushSubscriptionsUsed).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(new Error("offline"));
  });

  it("never throws into the caller", async () => {
    setUp();
    db.listPushTargets.mockRejectedValue(new Error("database down"));
    await expect(sendPush([message])).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(new Error("database down"));
  });
});
