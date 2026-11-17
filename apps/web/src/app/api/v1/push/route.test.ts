// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ saveAppPushToken: vi.fn(), deleteAppPushToken: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);

import { DELETE, POST } from "./route";

const token = "ExponentPushToken[abcdefghijklmnop]";
const call = async (handler: typeof POST, body: unknown) => {
  const response = await handler(new Request("http://localhost/api/v1/push", { method: "POST", body: JSON.stringify(body) }));
  return [response.status, await response.json()];
};

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
});

describe("/api/v1/push", () => {
  it("saves and removes this phone's token for the user", async () => {
    expect(await call(POST, { token, platform: "ios", locale: "en" })).toEqual([200, { ok: true }]);
    expect(db.saveAppPushToken).toHaveBeenCalledWith("u1", { token, platform: "ios", locale: "en" });
    expect(await call(DELETE, { token })).toEqual([200, { ok: true }]);
    expect(db.deleteAppPushToken).toHaveBeenCalledWith("u1", token);
  });

  it("refuses a token that is not Expo's", async () => {
    expect(await call(POST, { token: "https://evil.test", platform: "ios", locale: "en" })).toEqual([422, { error: "invalid" }]);
    expect(await call(DELETE, { token: "x" })).toEqual([422, { error: "invalid" }]);
    expect(db.saveAppPushToken).not.toHaveBeenCalled();
    expect(db.deleteAppPushToken).not.toHaveBeenCalled();
  });

  it("needs a signed-in user", async () => {
    session.currentUser.mockResolvedValue(null);
    expect(await call(POST, { token, platform: "ios", locale: "en" })).toEqual([401, { error: "signedOut" }]);
    expect(await call(DELETE, { token })).toEqual([401, { error: "signedOut" }]);
  });
});
