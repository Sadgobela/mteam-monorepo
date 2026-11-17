// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  countUnreadNotifications: vi.fn(),
  deleteSession: vi.fn(),
  getFavoriteIds: vi.fn(),
  getGelPerUsd: vi.fn(),
  getSessionUser: vi.fn(),
  listFavorites: vi.fn(),
  parseListingId: vi.fn(),
  requestLoginCode: vi.fn(),
  setFavorite: vi.fn(),
  verifyLoginCode: vi.fn(),
}));
const session = vi.hoisted(() => ({ clientIp: vi.fn(), currentUser: vi.fn(), sessionToken: vi.fn(), userAgent: vi.fn() }));
vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);

import { POST as requestCode } from "./auth/code/route";
import { POST as logout } from "./auth/logout/route";
import { POST as verify } from "./auth/verify/route";
import { PUT as setFavorite } from "./favorites/[id]/route";
import { GET as favorites } from "./favorites/route";
import { GET as me } from "./me/route";
import { POST as onboard } from "./onboarding/route";

const json = (body: unknown) => new Request("http://localhost/api/v1/x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const read = async (response: Response | Promise<Response>) => {
  const done = await response;
  return [done.status, await done.json()];
};
const user = { id: "u1", name: "Nino", phone: "+995555123456", role: "USER", onboardedAt: new Date() };

beforeEach(() => {
  vi.resetAllMocks();
  session.clientIp.mockResolvedValue("203.0.113.7");
  session.userAgent.mockResolvedValue("MTeam app");
  session.currentUser.mockResolvedValue(user);
  db.getGelPerUsd.mockResolvedValue(2.7);
});

describe("POST /api/v1/auth/code", () => {
  it("sends a code to a Georgian mobile number", async () => {
    db.requestLoginCode.mockResolvedValue(true);
    expect(await read(requestCode(json({ phone: "555 12 34 56" })))).toEqual([200, { phone: "+995555123456" }]);
    expect(db.requestLoginCode).toHaveBeenCalledWith("+995555123456", "203.0.113.7");
  });

  it("refuses a number that is not one, and a body that is not JSON", async () => {
    expect(await read(requestCode(json({ phone: "123" })))).toEqual([400, { error: "invalidPhone" }]);
    expect(await read(requestCode(json("{")))).toEqual([400, { error: "invalidPhone" }]);
    expect(db.requestLoginCode).not.toHaveBeenCalled();
  });

  it("says when a code was sent too recently", async () => {
    db.requestLoginCode.mockResolvedValue(false);
    expect(await read(requestCode(json({ phone: "555123456" })))).toEqual([429, { error: "tooSoon" }]);
  });
});

describe("POST /api/v1/auth/verify", () => {
  it("returns the session token and whether onboarding is done", async () => {
    db.verifyLoginCode.mockResolvedValue("tok");
    db.getSessionUser.mockResolvedValueOnce(user).mockResolvedValueOnce({ ...user, onboardedAt: null }).mockResolvedValueOnce(null);
    expect(await read(verify(json({ phone: "555123456", code: "123456" })))).toEqual([200, { token: "tok", onboarded: true }]);
    expect(db.verifyLoginCode).toHaveBeenCalledWith("+995555123456", "123456", "MTeam app");
    expect((await read(verify(json({ phone: "555123456", code: "123456" }))))[1]).toEqual({ token: "tok", onboarded: false });
    expect((await read(verify(json({ phone: "555123456", code: "123456" }))))[1]).toEqual({ token: "tok", onboarded: false });
  });

  it("refuses a wrong code, a bad number and a missing code", async () => {
    db.verifyLoginCode.mockResolvedValue(null);
    expect(await read(verify(json({ phone: "555123456", code: "000000" })))).toEqual([401, { error: "wrongCode" }]);
    expect(await read(verify(json({ phone: "1", code: "000000" })))).toEqual([400, { error: "invalidPhone" }]);
    expect(await read(verify(json({ phone: "555123456" })))).toEqual([400, { error: "invalidPhone" }]);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("deletes the session, and is fine without one", async () => {
    session.sessionToken.mockResolvedValueOnce("tok").mockResolvedValueOnce(undefined);
    expect(await read(logout())).toEqual([200, { ok: true }]);
    expect(db.deleteSession).toHaveBeenCalledWith("tok");
    expect(await read(logout())).toEqual([200, { ok: true }]);
    expect(db.deleteSession).toHaveBeenCalledTimes(1);
  });
});

describe("signed-out requests", () => {
  it.each([
    ["me", () => me()],
    ["favorites", () => favorites()],
    ["onboarding", () => onboard(json({}))],
    ["a favourite", () => setFavorite(json({ favorite: true }), { params: Promise.resolve({ id: "1" }) })],
  ])("%s says signed out", async (_name, call) => {
    session.currentUser.mockResolvedValue(null);
    expect(await read(call())).toEqual([401, { error: "signedOut" }]);
  });
});

describe("GET /api/v1/me", () => {
  it("returns the user, the broker they are, their favourites and the unread notifications", async () => {
    db.getFavoriteIds.mockResolvedValue([3, 4]);
    db.countUnreadNotifications.mockResolvedValue(2);
    expect(await read(me())).toEqual([200, { id: "u1", name: "Nino", phone: "+995555123456", role: "USER", onboarded: true, agentId: null, favoriteIds: [3, 4], unread: 2 }]);
    session.currentUser.mockResolvedValue({ ...user, onboardedAt: null, agent: { id: "a1" } });
    expect((await read(me()))[1]).toMatchObject({ onboarded: false, agentId: "a1" });
  });
});

describe("POST /api/v1/onboarding", () => {
  it("saves the answers once the terms are accepted", async () => {
    expect(await read(onboard(json({ name: " Nino ", intent: "OWNER", terms: true })))).toEqual([200, { ok: true }]);
    expect(db.completeOnboarding).toHaveBeenCalledWith("u1", { name: "Nino", intent: "OWNER" });
  });

  it("refuses without the terms or with a bad name", async () => {
    expect(await read(onboard(json({ name: "Nino", intent: "OWNER", terms: false })))).toEqual([422, { error: "invalid" }]);
    expect(await read(onboard(json({ name: "N", intent: "OWNER", terms: true })))).toEqual([422, { error: "invalid" }]);
    expect(db.completeOnboarding).not.toHaveBeenCalled();
  });
});

describe("favourites", () => {
  it("lists them without phone numbers", async () => {
    db.listFavorites.mockResolvedValue([{ id: 3, contactPhone: "+995555000000" }]);
    expect(await read(favorites())).toEqual([200, { listings: [{ id: 3 }], gelPerUsd: 2.7 }]);
  });

  it("sets a heart to the state asked for", async () => {
    db.parseListingId.mockReturnValue(3);
    expect(await read(setFavorite(json({ favorite: false }), { params: Promise.resolve({ id: "3" }) }))).toEqual([200, { id: 3, favorite: false }]);
    expect(db.setFavorite).toHaveBeenCalledWith("u1", 3, false);
  });

  it("refuses a bad id or body", async () => {
    db.parseListingId.mockReturnValueOnce(null).mockReturnValueOnce(3);
    expect(await read(setFavorite(json({ favorite: true }), { params: Promise.resolve({ id: "x" }) }))).toEqual([400, { error: "invalid" }]);
    expect(await read(setFavorite(json({ favorite: "yes" }), { params: Promise.resolve({ id: "3" }) }))).toEqual([400, { error: "invalid" }]);
    expect(db.setFavorite).not.toHaveBeenCalled();
  });
});
