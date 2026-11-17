// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  deleteSavedSearch: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
  listSavedSearches: vi.fn(),
  openSavedSearch: vi.fn(),
  parseListingId: vi.fn((raw: string) => (/^\d+$/.test(raw) ? Number(raw) : null)),
  saveSearch: vi.fn(),
  sendMessage: vi.fn(),
  startConversation: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock("@mteam/db", () => db);
vi.mock("@/lib/session", () => session);

import { GET as conversations, POST as startChat } from "./conversations/route";
import { GET as conversation, POST as send } from "./conversations/[id]/route";
import { GET as savedSearches, POST as save } from "./saved-searches/route";
import { DELETE as remove } from "./saved-searches/[id]/route";
import { POST as open } from "./saved-searches/[id]/open/route";

const read = async (response: Response | Promise<Response>) => {
  const done = await response;
  return [done.status, await done.json()];
};
const post = (body: unknown) => new Request("http://localhost/api/v1/x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const get = (url = "http://localhost/api/v1/x") => new Request(url);
const id = (value: string) => ({ params: Promise.resolve({ id: value }) });
const at = new Date("2026-11-15T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  session.currentUser.mockResolvedValue({ id: "u1" });
});

describe("conversations", () => {
  it("lists the user's chats", async () => {
    db.listConversations.mockResolvedValue([{ id: "c1", listingId: 7, listingTitle: "Flat", otherName: "Nino", lastBody: "Hi", lastAt: at, unread: true }]);
    expect(await read(conversations())).toEqual([200, { conversations: [{ id: "c1", listingId: 7, listingTitle: "Flat", otherName: "Nino", lastBody: "Hi", lastAt: at.toISOString(), unread: true }] }]);
    expect(db.listConversations).toHaveBeenCalledWith("u1");
  });

  it("starts a chat about a listing, and says when it cannot", async () => {
    db.startConversation.mockResolvedValueOnce("c1").mockResolvedValueOnce(null);
    expect(await read(startChat(post({ listingId: 7, body: "  Is it free? " })))).toEqual([200, { id: "c1" }]);
    expect(db.startConversation).toHaveBeenCalledWith("u1", 7, "Is it free?");
    expect(await read(startChat(post({ listingId: "7", body: "Hi" })))).toEqual([422, { error: "failed" }]);
  });

  it("refuses a missing listing, an empty message and a broken body", async () => {
    expect(await read(startChat(post({ listingId: "x", body: "Hi" })))).toEqual([400, { error: "invalid" }]);
    expect(await read(startChat(post({ listingId: 7, body: "   " })))).toEqual([400, { error: "invalid" }]);
    expect(await read(startChat(post("{")))).toEqual([400, { error: "invalid" }]);
    expect(db.startConversation).not.toHaveBeenCalled();
  });

  it("shows one chat to someone in it, and nobody else", async () => {
    db.getConversation.mockResolvedValueOnce({ id: "c1", listingId: 7, listingTitle: "Flat", otherName: null, messages: [{ id: "m1", body: "Hi", mine: false, at }] }).mockResolvedValueOnce(null);
    expect(await read(conversation(get(), id("c1")))).toEqual([200, { id: "c1", listingId: 7, listingTitle: "Flat", otherName: null, messages: [{ id: "m1", body: "Hi", mine: false, at: at.toISOString() }] }]);
    expect(db.getConversation).toHaveBeenCalledWith("u1", "c1");
    expect(await read(conversation(get(), id("c9")))).toEqual([404, { error: "notFound" }]);
  });

  it("writes in a chat, and says when it cannot", async () => {
    db.sendMessage.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await read(send(post({ body: "Yes" }), id("c1")))).toEqual([200, { ok: true }]);
    expect(db.sendMessage).toHaveBeenCalledWith("u1", "c1", "Yes");
    expect(await read(send(post({ body: "Yes" }), id("c1")))).toEqual([422, { error: "failed" }]);
    expect(await read(send(post({ body: "" }), id("c1")))).toEqual([400, { error: "invalid" }]);
    expect(await read(send(post("{"), id("c1")))).toEqual([400, { error: "invalid" }]);
  });
});

describe("saved searches", () => {
  it("lists them with a name in the asked language, other filters counted, and what is new", async () => {
    db.listSavedSearches.mockResolvedValue([
      { id: "s1", query: "city=თბილისი&deal=rent&rooms=2", filters: { deal: "rent", city: "თბილისი", rooms: 2, type: undefined }, newCount: 3 },
      { id: "s2", query: "verified=1", filters: { verified: true }, newCount: 0 },
    ]);
    const [status, body] = await read(savedSearches(get("http://localhost/api/v1/saved-searches?locale=en")));
    expect(status).toBe(200);
    expect(body.searches).toEqual([
      { id: "s1", query: "city=თბილისი&deal=rent&rooms=2", name: "For rent · Tbilisi", others: 1, newCount: 3 },
      { id: "s2", query: "verified=1", name: "All listings", others: 1, newCount: 0 },
    ]);
    const [, georgian] = await read(savedSearches(get()));
    expect(georgian.searches[1].name).toBe("ყველა განცხადება");
  });

  it("saves a search in the site's form, and says when the user has too many", async () => {
    db.saveSearch.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const [status, body] = await read(save(post({ query: "page=2&deal=rent&city=თბილისი" })));
    expect(status).toBe(200);
    expect(db.saveSearch).toHaveBeenCalledWith("u1", body.query);
    expect(body.query).not.toContain("page");
    expect(await read(save(post({ query: "deal=sale" })))).toEqual([409, { error: "limit" }]);
  });

  it("refuses a search with no filters and a broken body", async () => {
    expect(await read(save(post({ query: "page=2" })))).toEqual([400, { error: "invalid" }]);
    expect(await read(save(post("{")))).toEqual([400, { error: "invalid" }]);
    expect(db.saveSearch).not.toHaveBeenCalled();
  });

  it("removes one, and opens one by answering with its filters", async () => {
    expect(await read(remove(get(), id("s1")))).toEqual([200, { ok: true }]);
    expect(db.deleteSavedSearch).toHaveBeenCalledWith("u1", "s1");
    db.openSavedSearch.mockResolvedValueOnce("deal=rent").mockResolvedValueOnce(null);
    expect(await read(open(post({}), id("s1")))).toEqual([200, { query: "deal=rent" }]);
    expect(await read(open(post({}), id("s9")))).toEqual([404, { error: "notFound" }]);
  });
});

it.each([
  ["GET conversations", () => conversations()],
  ["POST conversations", () => startChat(post({ listingId: 7, body: "Hi" }))],
  ["GET conversation", () => conversation(get(), id("c1"))],
  ["POST conversation", () => send(post({ body: "Hi" }), id("c1"))],
  ["GET saved searches", () => savedSearches(get())],
  ["POST saved searches", () => save(post({ query: "deal=rent" }))],
  ["DELETE saved search", () => remove(get(), id("s1"))],
  ["POST open saved search", () => open(post({}), id("s1"))],
])("%s says signed out", async (_name, call) => {
  session.currentUser.mockResolvedValue(null);
  expect(await read(call())).toEqual([401, { error: "signedOut" }]);
});
