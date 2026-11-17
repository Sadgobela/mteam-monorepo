// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ countUnreadNotifications: vi.fn(), listNotifications: vi.fn(), markAllNotificationsRead: vi.fn(), openNotification: vi.fn(), openSavedSearch: vi.fn() }));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);

import { GET as list, POST as readAll } from "./route";
import { POST as open } from "./[id]/route";

const read = async (response: Response | Promise<Response>) => {
  const done = await response;
  return [done.status, await done.json()];
};
const at = new Date("2026-11-15T10:00:00Z");
const opened = (id: string, body: unknown) =>
  open(new Request(`http://localhost/api/v1/notifications/${id}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
});

describe("GET /api/v1/notifications", () => {
  it("lists the notifications in the asked language, with the unread count", async () => {
    db.listNotifications.mockResolvedValue([
      { id: "n1", type: "LISTING_APPROVED", listingId: 7, listingTitle: "Flat in Vake", read: false, at },
      { id: "n2", type: "MESSAGE", listingId: 7, listingTitle: "Flat in Vake", conversationId: "c1", count: 2, read: true, at },
    ]);
    db.countUnreadNotifications.mockResolvedValue(1);
    const [status, body] = await read(list(new Request("http://localhost/api/v1/notifications?locale=en")));
    expect(status).toBe(200);
    expect(body).toEqual({
      notifications: [
        { id: "n1", read: false, at: at.toISOString(), title: "Flat in Vake", body: "Your listing is published" },
        { id: "n2", read: true, at: at.toISOString(), title: "Flat in Vake", body: "New messages: 2" },
      ],
      unread: 1,
    });
    expect(db.listNotifications).toHaveBeenCalledWith("u1");
  });

  it("falls back to Georgian without a language", async () => {
    db.listNotifications.mockResolvedValue([{ id: "n1", type: "LISTING_REJECTED", listingId: 7, listingTitle: "ბინა", read: false, at }]);
    db.countUnreadNotifications.mockResolvedValue(1);
    const [, body] = await read(list(new Request("http://localhost/api/v1/notifications")));
    expect(body.notifications[0].body).toMatch(/[ა-ჰ]/);
  });

  it("answers signed out without a session", async () => {
    session.currentUser.mockResolvedValue(null);
    expect(await read(list(new Request("http://localhost/api/v1/notifications")))).toEqual([401, { error: "signedOut" }]);
    expect(await read(readAll())).toEqual([401, { error: "signedOut" }]);
    expect(await read(opened("n1", { locale: "en" }))).toEqual([401, { error: "signedOut" }]);
  });
});

describe("POST /api/v1/notifications", () => {
  it("marks them all read", async () => {
    expect(await read(readAll())).toEqual([200, { ok: true }]);
    expect(db.markAllNotificationsRead).toHaveBeenCalledWith("u1");
  });
});

describe("POST /api/v1/notifications/<id>", () => {
  it("marks one read and answers with where it leads, in the app's language", async () => {
    db.openNotification.mockResolvedValue({ type: "PRICE_DROP", listingId: 7, listingTitle: "Flat", oldPriceUsd: 2, newPriceUsd: 1 });
    expect(await read(opened("n1", { locale: "en" }))).toEqual([200, { path: "/en/listings/7" }]);
    expect(db.openNotification).toHaveBeenCalledWith("u1", "n1");
  });

  it("opens a saved search's results, and Georgian without a language", async () => {
    db.openNotification.mockResolvedValue({ type: "SEARCH_MATCHES", savedSearchId: "s1", query: "deal=rent", count: 3 });
    db.openSavedSearch.mockResolvedValue("deal=rent");
    expect(await read(opened("n1", {}))).toEqual([200, { path: "/ka?deal=rent" }]);
  });

  it("does not find someone else's notification, and refuses a broken body", async () => {
    db.openNotification.mockResolvedValue(null);
    expect(await read(opened("n9", { locale: "en" }))).toEqual([404, { error: "notFound" }]);
    expect(await read(opened("n9", "{"))).toEqual([400, { error: "invalid" }]);
  });
});
