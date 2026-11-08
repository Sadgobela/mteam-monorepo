// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ get: vi.fn(), has: vi.fn(), set: vi.fn(), delete: vi.fn() }));
const db = vi.hoisted(() => ({ getSessionUser: vi.fn(), deleteSession: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("@mteam/db", () => db);

import { currentUser, endSession, hasSession, startSession } from "./session";

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("currentUser", () => {
  it("validates the cookie against the database", async () => {
    store.get.mockReturnValue({ value: "tok" });
    db.getSessionUser.mockResolvedValue({ id: "u1" });
    expect(await currentUser()).toEqual({ id: "u1" });
    expect(db.getSessionUser).toHaveBeenCalledWith("tok");
  });

  it("is null without a cookie", async () => {
    store.get.mockReturnValue(undefined);
    expect(await currentUser()).toBeNull();
    expect(db.getSessionUser).not.toHaveBeenCalled();
  });
});

describe("hasSession", () => {
  it("reports whether the cookie exists", async () => {
    store.has.mockReturnValue(true);
    expect(await hasSession()).toBe(true);
    expect(store.has).toHaveBeenCalledWith("mteam_session");
  });
});

describe("startSession", () => {
  it("sets an http-only cookie", async () => {
    await startSession("tok");
    expect(store.set).toHaveBeenCalledWith("mteam_session", "tok", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 2592000,
    });
  });

  it("requires https in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await startSession("tok");
    expect(store.set.mock.calls[0][2].secure).toBe(true);
  });
});

describe("endSession", () => {
  it("removes the session from the database and the browser", async () => {
    store.get.mockReturnValue({ value: "tok" });
    await endSession();
    expect(db.deleteSession).toHaveBeenCalledWith("tok");
    expect(store.delete).toHaveBeenCalledWith("mteam_session");
  });

  it("still clears the browser with no token", async () => {
    store.get.mockReturnValue(undefined);
    await endSession();
    expect(db.deleteSession).not.toHaveBeenCalled();
    expect(store.delete).toHaveBeenCalledWith("mteam_session");
  });
});
