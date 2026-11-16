// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ savePushSubscription: vi.fn(), deletePushSubscription: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);

import { POST as subscribe } from "./subscribe/route";
import { POST as unsubscribe } from "./unsubscribe/route";

const keys = { p256dh: "B".repeat(87), auth: "a1_-".repeat(5) + "zz" };
const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/abc:123", expirationTime: null, keys };

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/push/${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });

const send = async (handler: (request: Request) => Promise<Response>, request: Request) => {
  const response = await handler(request);
  return [response.status, await response.json()];
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
});

describe("POST /api/push/subscribe", () => {
  it("saves the browser for the signed-in user, in the page's language, with its user agent", async () => {
    expect(await send(subscribe, post("subscribe", { ...subscription, locale: "en" }, { "user-agent": "Safari", origin: "http://localhost" }))).toEqual([200, { ok: true }]);
    expect(db.savePushSubscription).toHaveBeenCalledWith("u1", { endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth, locale: "en", userAgent: "Safari" });
  });

  it("keeps no user agent when the browser sends none, and cuts a long one", async () => {
    await subscribe(post("subscribe", { ...subscription, locale: "ka" }));
    expect(db.savePushSubscription.mock.calls[0][1].userAgent).toBeNull();
    await subscribe(post("subscribe", { ...subscription, locale: "ka" }, { "user-agent": "x".repeat(600) }));
    expect(db.savePushSubscription.mock.calls[1][1].userAgent).toHaveLength(512);
  });

  it.each([
    ["Apple", "https://web.push.apple.com/QGuQyavXutnMH"],
    ["Mozilla", "https://updates.push.services.mozilla.com/wpush/v2/gAAA"],
    ["Windows", "https://wns2-db5p.notify.windows.com/w/?token=BQYAAA"],
  ])("accepts %s's push service", async (_name, endpoint) => {
    expect((await send(subscribe, post("subscribe", { ...subscription, endpoint, locale: "ru" })))[0]).toBe(200);
  });

  it("turns away a request sent from another site's page, before anything else", async () => {
    expect(await send(subscribe, post("subscribe", subscription, { origin: "https://evil.test" }))).toEqual([403, { error: "crossSite" }]);
    expect(session.currentUser).not.toHaveBeenCalled();
  });

  it("asks a visitor to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    expect(await send(subscribe, post("subscribe", { ...subscription, locale: "en" }))).toEqual([401, { error: "signedOut" }]);
  });

  it.each([
    ["a body that is not JSON", "{"],
    ["no language", subscription],
    ["an unknown language", { ...subscription, locale: "de" }],
    ["an address that is not a push service", { ...subscription, endpoint: "https://internal.example/hook", locale: "en" }],
    ["a push service address over plain http", { ...subscription, endpoint: "http://fcm.googleapis.com/fcm/send/abc", locale: "en" }],
    ["a host that only ends like one", { ...subscription, endpoint: "https://evil.fcm.googleapis.com.test/x", locale: "en" }],
    ["an address too long to be real", { ...subscription, endpoint: `https://fcm.googleapis.com/${"a".repeat(1100)}`, locale: "en" }],
    ["a key that is not base64url", { ...subscription, keys: { ...keys, p256dh: "!".repeat(87) }, locale: "en" }],
    ["a secret of the wrong length", { ...subscription, keys: { ...keys, auth: "short" }, locale: "en" }],
    ["no keys", { endpoint: subscription.endpoint, locale: "en" }],
  ])("refuses %s", async (_name, body) => {
    expect(await send(subscribe, post("subscribe", body))).toEqual([422, { error: "invalid" }]);
    expect(db.savePushSubscription).not.toHaveBeenCalled();
  });
});

describe("POST /api/push/unsubscribe", () => {
  it("removes the browser from the signed-in user's own", async () => {
    expect(await send(unsubscribe, post("unsubscribe", { endpoint: subscription.endpoint }))).toEqual([200, { ok: true }]);
    expect(db.deletePushSubscription).toHaveBeenCalledWith("u1", subscription.endpoint);
  });

  it("turns away other sites, visitors and bodies that are not an address", async () => {
    expect(await send(unsubscribe, post("unsubscribe", {}, { origin: "https://evil.test" }))).toEqual([403, { error: "crossSite" }]);
    expect(await send(unsubscribe, post("unsubscribe", "nope"))).toEqual([422, { error: "invalid" }]);
    expect(await send(unsubscribe, post("unsubscribe", { endpoint: "not a url" }))).toEqual([422, { error: "invalid" }]);
    session.currentUser.mockResolvedValue(null);
    expect(await send(unsubscribe, post("unsubscribe", { endpoint: subscription.endpoint }))).toEqual([401, { error: "signedOut" }]);
    expect(db.deletePushSubscription).not.toHaveBeenCalled();
  });
});
