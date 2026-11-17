// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  archiveListing: vi.fn(),
  bumpListing: vi.fn(),
  countMyListings: vi.fn(),
  deleteAccount: vi.fn(),
  deleteDraft: vi.fn(),
  getBranch: vi.fn(),
  getBroker: vi.fn(),
  getEditableListing: vi.fn(),
  getGelPerUsd: vi.fn(),
  getPreferences: vi.fn(),
  getProfile: vi.fn(),
  getPublicPerson: vi.fn(),
  listBranches: vi.fn(),
  listBrokers: vi.fn(),
  listMyListingsTab: vi.fn(),
  listSellerListings: vi.fn(),
  myListingTabs: ["active", "pending", "draft", "expiring", "archived", "rejected"],
  parseListingId: vi.fn((raw: string) => (/^\d+$/.test(raw) ? Number(raw) : null)),
  PREFERENCE_KEYS: ["notifyMessages", "notifySavedSearches", "notifyPriceDrops", "notifyListingUpdates", "notifyPush", "hidePhoneDefault"],
  priceStats: vi.fn(),
  renewListing: vi.fn(),
  setPreference: vi.fn(),
  updateProfile: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
const avatar = vi.hoisted(() => ({ saveAvatarUpload: vi.fn() }));
vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/avatar", async (original) => ({ ...(await original<typeof import("@/lib/avatar")>()), saveAvatarUpload: avatar.saveAvatarUpload }));

import { NextResponse } from "next/server";
import { DELETE as deleteAccount } from "./account/route";
import { GET as branch } from "./branches/[id]/route";
import { GET as broker } from "./brokers/[id]/route";
import { GET as brokers } from "./brokers/route";
import { POST as act } from "./my-listings/[id]/[action]/route";
import { DELETE as deleteDraft, GET as editable } from "./my-listings/[id]/route";
import { GET as myListings } from "./my-listings/route";
import { GET as prices } from "./prices/route";
import { POST as uploadAvatar } from "./profile/avatar/route";
import { GET as profile, PUT as saveProfile } from "./profile/route";
import { GET as seller } from "./sellers/[id]/route";
import { GET as settings, PUT as setSwitch } from "./settings/route";

const read = async (response: Response | Promise<Response>) => {
  const done = await response;
  return [done.status, await done.json()];
};
const get = (url = "http://localhost/api/v1/x") => new Request(url);
const send = (method: string, body: unknown) => new Request("http://localhost/api/v1/x", { method, body: typeof body === "string" ? body : JSON.stringify(body) });
const id = (value: string) => ({ params: Promise.resolve({ id: value }) });
const listing = { id: 9, title: "Flat", contactPhone: "+995555000000", agent: { id: "a1", name: "Ana", branch: "Vake", phone: "+995555111111" } };
const shown = { id: 9, title: "Flat", agent: { id: "a1", name: "Ana", branch: "Vake" } };
const user = { id: "u1", role: "USER" };

beforeEach(() => {
  vi.clearAllMocks();
  session.currentUser.mockResolvedValue(user);
  db.getGelPerUsd.mockResolvedValue(2.7);
});

describe("brokers, branches and sellers", () => {
  it("lists the branches and brokers, without the brokers' phones", async () => {
    const office = { id: "b1", name: "Vake office", city: "თბილისი", brokerCount: 2, listingCount: 5 };
    db.listBranches.mockResolvedValue([office]);
    db.listBrokers.mockResolvedValue([{ id: "a1", name: "Ana", branch: "Vake office", phone: "+995555111111", listingCount: 3 }]);
    expect(await read(brokers())).toEqual([200, { branches: [office], brokers: [{ id: "a1", name: "Ana", branch: "Vake office", listingCount: 3 }] }]);
  });

  it("shows one broker with their phone and listings, and nobody else", async () => {
    db.getBroker.mockResolvedValueOnce({ id: "a1", name: "Ana", branch: "Vake office", phone: "+995555111111", photoUrl: null, bio: "Hi", listings: [listing] }).mockResolvedValueOnce(null);
    expect(await read(broker(get(), id("a1")))).toEqual([
      200,
      { broker: { id: "a1", name: "Ana", branch: "Vake office", phone: "+995555111111", photoUrl: null, bio: "Hi" }, listings: [shown], gelPerUsd: 2.7 },
    ]);
    expect(db.getBroker).toHaveBeenCalledWith("a1");
    expect(await read(broker(get(), id("x")))).toEqual([404, { error: "notFound" }]);
  });

  it("shows one branch with its brokers and listings, and 404 for an empty one", async () => {
    db.getBranch
      .mockResolvedValueOnce({ id: "b1", name: "Vake office", city: "თბილისი", brokers: [{ id: "a1", name: "Ana", branch: "Vake office", phone: "+995555111111", listingCount: 3 }], listings: [listing] })
      .mockResolvedValueOnce(null);
    expect(await read(branch(get(), id("b1")))).toEqual([
      200,
      { branch: { id: "b1", name: "Vake office", city: "თბილისი" }, brokers: [{ id: "a1", name: "Ana", branch: "Vake office", listingCount: 3 }], listings: [shown], gelPerUsd: 2.7 },
    ]);
    expect(await read(branch(get(), id("b2")))).toEqual([404, { error: "notFound" }]);
  });

  it("shows a seller's name and listings, and 404 for someone with nothing published", async () => {
    db.getPublicPerson.mockResolvedValue({ name: "Nino", avatarUrl: null });
    db.listSellerListings.mockResolvedValueOnce([listing]).mockResolvedValueOnce([]);
    expect(await read(seller(get(), id("u2")))).toEqual([200, { seller: { name: "Nino", avatarUrl: null }, listings: [shown], gelPerUsd: 2.7 }]);
    expect(db.listSellerListings).toHaveBeenCalledWith("u2");
    expect(await read(seller(get(), id("u3")))).toEqual([404, { error: "notFound" }]);
    db.getPublicPerson.mockResolvedValue(null);
    db.listSellerListings.mockResolvedValue([listing]);
    expect(await read(seller(get(), id("gone")))).toEqual([404, { error: "notFound" }]);
  });
});

describe("prices", () => {
  it("gives the asked city and deal, and Tbilisi sales for anything else", async () => {
    db.priceStats.mockResolvedValue([{ district: "ვაკე", rooms: 2, median: 1500 }]);
    expect(await read(prices(get("http://localhost/api/v1/prices?city=ბათუმი&deal=rent")))).toEqual([200, { city: "ბათუმი", deal: "rent", stats: [{ district: "ვაკე", rooms: 2, median: 1500 }] }]);
    expect(db.priceStats).toHaveBeenCalledWith("ბათუმი", "rent");
    expect((await read(prices(get("http://localhost/api/v1/prices?deal=daily"))))[1]).toMatchObject({ city: "თბილისი", deal: "sale" });
    expect(db.priceStats).toHaveBeenLastCalledWith("თბილისი", "sale");
  });
});

describe("profile", () => {
  it("shows the user's profile and saves a new name and intent", async () => {
    db.getProfile.mockResolvedValue({ name: "Nino", avatarUrl: null, intent: "SEEKING", createdAt: new Date("2026-11-01T10:00:00Z") });
    expect(await read(profile())).toEqual([200, { name: "Nino", avatarUrl: null, intent: "SEEKING", createdAt: "2026-11-01T10:00:00.000Z" }]);
    expect(await read(saveProfile(send("PUT", { name: "  Nino B ", intent: "OWNER" })))).toEqual([200, { ok: true }]);
    expect(db.updateProfile).toHaveBeenCalledWith("u1", { name: "Nino B", intent: "OWNER" });
  });

  it("refuses a name too short, an unknown intent and a broken body", async () => {
    expect(await read(saveProfile(send("PUT", { name: "N", intent: "OWNER" })))).toEqual([422, { error: "invalid" }]);
    expect(await read(saveProfile(send("PUT", { name: "Nino", intent: "ADMIN" })))).toEqual([422, { error: "invalid" }]);
    expect(await read(saveProfile(send("PUT", "{")))).toEqual([422, { error: "invalid" }]);
    expect(db.updateProfile).not.toHaveBeenCalled();
  });

  it("takes a new photo from the app for the signed-in user", async () => {
    avatar.saveAvatarUpload.mockResolvedValue(NextResponse.json({ avatarUrl: "https://cdn.test/a.webp" }));
    const request = send("POST", "photo");
    expect(await read(uploadAvatar(request))).toEqual([200, { avatarUrl: "https://cdn.test/a.webp" }]);
    expect(avatar.saveAvatarUpload).toHaveBeenCalledWith(request, "u1");
  });
});

describe("settings", () => {
  it("shows the switches and whether the account can be deleted here", async () => {
    const preferences = { notifyMessages: true, notifySavedSearches: true, notifyPriceDrops: false, notifyListingUpdates: true, notifyPush: true, hidePhoneDefault: false };
    db.getPreferences.mockResolvedValue(preferences);
    expect(await read(settings())).toEqual([200, { preferences, canDelete: true }]);
    session.currentUser.mockResolvedValue({ id: "a", role: "AGENT" });
    expect((await read(settings()))[1]).toMatchObject({ canDelete: false });
  });

  it("flips one known switch, and refuses anything else", async () => {
    expect(await read(setSwitch(send("PUT", { key: "notifyPriceDrops", value: true })))).toEqual([200, { ok: true }]);
    expect(db.setPreference).toHaveBeenCalledWith("u1", "notifyPriceDrops", true);
    expect(await read(setSwitch(send("PUT", { key: "role", value: true })))).toEqual([400, { error: "invalid" }]);
    expect(await read(setSwitch(send("PUT", { key: "notifyPush", value: "no" })))).toEqual([400, { error: "invalid" }]);
    expect(db.setPreference).toHaveBeenCalledTimes(1);
  });

  it("deletes a private person's account once confirmed, and refuses staff", async () => {
    db.deleteAccount.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await read(deleteAccount(send("DELETE", { confirm: "no" })))).toEqual([400, { error: "invalid" }]);
    expect(db.deleteAccount).not.toHaveBeenCalled();
    expect(await read(deleteAccount(send("DELETE", { confirm: "yes" })))).toEqual([200, { ok: true }]);
    expect(db.deleteAccount).toHaveBeenCalledWith("u1");
    // Refused by the database: the role changed a moment earlier.
    expect(await read(deleteAccount(send("DELETE", { confirm: "yes" })))).toEqual([403, { error: "staff" }]);
    session.currentUser.mockResolvedValue({ id: "a", role: "AGENT" });
    expect(await read(deleteAccount(send("DELETE", { confirm: "yes" })))).toEqual([403, { error: "staff" }]);
    expect(db.deleteAccount).toHaveBeenCalledTimes(2);
  });
});

describe("my listings", () => {
  const counts = { active: 0, pending: 1, draft: 2, expiring: 0, archived: 0, rejected: 0 };
  const mine = { listing, status: "PENDING", views: 4, phoneReveals: 1, favorites: 2, conversations: 0, canRenew: false, canBump: false };

  it("opens the first tab with something in it, with the numbers and what can be done", async () => {
    db.countMyListings.mockResolvedValue(counts);
    db.listMyListingsTab.mockResolvedValue([mine, { ...mine, status: "ACTIVE", expiresAt: new Date("2026-12-01T00:00:00Z"), nextBumpAt: new Date("2026-11-18T09:00:00Z") }]);
    expect(await read(myListings(get()))).toEqual([
      200,
      {
        tab: "pending",
        counts,
        listings: [
          { ...shown, status: "PENDING", views: 4, phoneReveals: 1, favorites: 2, conversations: 0, canRenew: false, canBump: false, expiresAt: null, nextBumpAt: null },
          { ...shown, status: "ACTIVE", views: 4, phoneReveals: 1, favorites: 2, conversations: 0, canRenew: false, canBump: false, expiresAt: "2026-12-01T00:00:00.000Z", nextBumpAt: "2026-11-18T09:00:00.000Z" },
        ],
        gelPerUsd: 2.7,
      },
    ]);
    expect(db.listMyListingsTab).toHaveBeenCalledWith("u1", { tab: "pending" });
  });

  it("opens the asked tab, and the active one when there is nothing at all", async () => {
    db.countMyListings.mockResolvedValue(counts);
    db.listMyListingsTab.mockResolvedValue([]);
    expect((await read(myListings(get("http://localhost/api/v1/my-listings?tab=draft"))))[1]).toMatchObject({ tab: "draft" });
    db.countMyListings.mockResolvedValue({ ...counts, pending: 0, draft: 0 });
    expect((await read(myListings(get("http://localhost/api/v1/my-listings?tab=nope"))))[1]).toMatchObject({ tab: "active", listings: [] });
  });

  it("gives the user's own listing to edit, and nobody else's", async () => {
    const form = { id: 9, status: "ACTIVE", fields: { title: "Flat", specs: "" }, images: ["https://cdn.test/a.jpg"] };
    db.getEditableListing.mockResolvedValueOnce(form).mockResolvedValueOnce(null);
    expect(await read(editable(get(), id("9")))).toEqual([200, form]);
    expect(db.getEditableListing).toHaveBeenCalledWith("u1", "9");
    expect(await read(editable(get(), id("10")))).toEqual([404, { error: "notFound" }]);
  });

  it("deletes an unfinished draft of the user's, and nothing else", async () => {
    db.deleteDraft.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await read(deleteDraft(get(), id("9")))).toEqual([200, { ok: true }]);
    expect(db.deleteDraft).toHaveBeenCalledWith("u1", 9);
    expect(await read(deleteDraft(get(), id("10")))).toEqual([404, { error: "notFound" }]);
    expect(await read(deleteDraft(get(), id("x")))).toEqual([404, { error: "notFound" }]);
    expect(db.deleteDraft).toHaveBeenCalledTimes(2);
  });

  it("moves a listing up, renews it or takes it down, and says when it cannot", async () => {
    const at = (action: string, raw = "9") => ({ params: Promise.resolve({ id: raw, action }) });
    db.bumpListing.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    db.renewListing.mockResolvedValue(true);
    expect(await read(act(get(), at("bump")))).toEqual([200, { ok: true }]);
    expect(db.bumpListing).toHaveBeenCalledWith("u1", 9);
    expect(await read(act(get(), at("bump")))).toEqual([409, { error: "failed" }]);
    expect(await read(act(get(), at("renew")))).toEqual([200, { ok: true }]);
    expect(await read(act(get(), at("archive")))).toEqual([200, { ok: true }]);
    expect(db.archiveListing).toHaveBeenCalledWith("u1", 9);
    expect(await read(act(get(), at("toString")))).toEqual([404, { error: "notFound" }]);
    expect(await read(act(get(), at("bump", "x")))).toEqual([404, { error: "notFound" }]);
  });
});

describe("signed-out requests", () => {
  it.each([
    ["profile", () => profile()],
    ["saving the profile", () => saveProfile(send("PUT", {}))],
    ["a photo", () => uploadAvatar(send("POST", ""))],
    ["settings", () => settings()],
    ["a switch", () => setSwitch(send("PUT", {}))],
    ["deleting the account", () => deleteAccount(send("DELETE", { confirm: "yes" }))],
    ["my listings", () => myListings(get())],
    ["a listing to edit", () => editable(get(), id("9"))],
    ["deleting a draft", () => deleteDraft(get(), id("9"))],
    ["an action", () => act(get(), { params: Promise.resolve({ id: "9", action: "bump" }) })],
  ])("%s says signed out", async (_name, call) => {
    session.currentUser.mockResolvedValue(null);
    expect(await read(call())).toEqual([401, { error: "signedOut" }]);
    expect(db.deleteAccount).not.toHaveBeenCalled();
  });
});
