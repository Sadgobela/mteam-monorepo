import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  listing: { findFirst: vi.fn() },
  conversation: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  message: { count: vi.fn(), create: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { getConversation, listConversations, sendMessage, startConversation } from "./index";

const participant = { OR: [{ buyerId: "u1" }, { sellerId: "u1" }] };
const ownerListing = { ownerId: "owner", agent: null };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.message.count.mockResolvedValue(0);
  prisma.conversation.count.mockResolvedValue(0);
  prisma.conversation.findUnique.mockResolvedValue(null);
  prisma.conversation.upsert.mockResolvedValue({ id: "c1" });
});

describe("startConversation", () => {
  it("opens a chat with the owner and sends the message", async () => {
    prisma.listing.findFirst.mockResolvedValue(ownerListing);
    expect(await startConversation("u1", 7, "hi")).toBe("c1");
    expect(prisma.listing.findFirst.mock.calls[0][0].where).toEqual({ id: 7, status: "ACTIVE" });
    expect(prisma.conversation.upsert.mock.calls[0][0].create).toMatchObject({ listingId: 7, buyerId: "u1", sellerId: "owner" });
    expect(prisma.message.create).toHaveBeenCalledWith({ data: { conversationId: "c1", senderId: "u1", body: "hi" } });
  });

  it("goes to the broker while they are one, and otherwise the owner", async () => {
    prisma.listing.findFirst.mockResolvedValue({ ownerId: "owner", agent: { userId: "broker", user: { role: "AGENT" } } });
    await startConversation("u1", 7, "hi");
    expect(prisma.conversation.upsert.mock.calls[0][0].create.sellerId).toBe("broker");
    prisma.listing.findFirst.mockResolvedValue({ ownerId: "owner", agent: { userId: "broker", user: { role: "USER" } } });
    await startConversation("u1", 7, "hi");
    expect(prisma.conversation.upsert.mock.calls[1][0].create.sellerId).toBe("owner");
  });

  it("refuses an unpublished listing and writing to oneself", async () => {
    prisma.listing.findFirst.mockResolvedValue(null);
    expect(await startConversation("u1", 7, "hi")).toBeNull();
    prisma.listing.findFirst.mockResolvedValue({ ownerId: "u1", agent: null });
    expect(await startConversation("u1", 7, "hi")).toBeNull();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("moves an existing chat to whoever answers now", async () => {
    prisma.listing.findFirst.mockResolvedValue({ ownerId: "owner", agent: { userId: "broker", user: { role: "USER" } } });
    await startConversation("u1", 7, "hi");
    expect(prisma.conversation.upsert.mock.calls[0][0].update.sellerId).toBe("owner");
  });

  it("stops too many messages, and too many new chats but not an existing one", async () => {
    prisma.listing.findFirst.mockResolvedValue(ownerListing);
    prisma.message.count.mockResolvedValueOnce(60);
    expect(await startConversation("u1", 7, "hi")).toBeNull();

    prisma.conversation.count.mockResolvedValue(20);
    expect(await startConversation("u1", 7, "hi")).toBeNull();

    prisma.conversation.findUnique.mockResolvedValue({ id: "c1" });
    expect(await startConversation("u1", 7, "hi")).toBe("c1");
  });
});

describe("sendMessage", () => {
  it("lets only someone in the chat write", async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    expect(await sendMessage("u1", "c1", "hi")).toBe(false);
    expect(prisma.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: "c1", ...participant });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it("stops too many messages", async () => {
    prisma.conversation.findFirst.mockResolvedValue({ buyerId: "u1", listing: ownerListing });
    prisma.message.count.mockResolvedValue(60);
    expect(await sendMessage("u1", "c1", "hi")).toBe(false);
  });

  it("sends, and counts as read for whoever wrote", async () => {
    prisma.conversation.findFirst.mockResolvedValue({ buyerId: "u1", listing: ownerListing });
    expect(await sendMessage("u1", "c1", "hi")).toBe(true);
    expect(prisma.conversation.update.mock.calls[0][0].data).toHaveProperty("buyerReadAt");
    prisma.conversation.findFirst.mockResolvedValue({ buyerId: "someone", listing: { ownerId: "u1", agent: null } });
    await sendMessage("u1", "c1", "hi");
    expect(prisma.conversation.update.mock.calls[1][0].data).toHaveProperty("sellerReadAt");
  });

  it("drops a broker who left, and hands the chat to the owner when the buyer writes", async () => {
    const left = { ownerId: "owner", agent: { userId: "u1", user: { role: "USER" } } };
    prisma.conversation.findFirst.mockResolvedValue({ buyerId: "buyer", listing: left });
    expect(await sendMessage("u1", "c1", "hi")).toBe(false);
    expect(prisma.message.create).not.toHaveBeenCalled();

    prisma.conversation.findFirst.mockResolvedValue({ buyerId: "u1", listing: { ...left, agent: { userId: "broker", user: { role: "USER" } } } });
    await sendMessage("u1", "c1", "hi");
    expect(prisma.conversation.update.mock.calls[0][0].data.sellerId).toBe("owner");
  });
});

describe("listConversations", () => {
  const row = (over: object) => ({
    id: "c1",
    listingId: 7,
    buyerId: "u1",
    buyerReadAt: null,
    sellerReadAt: null,
    listing: { title: "Flat" },
    buyer: { name: "Buyer" },
    seller: { name: "Seller" },
    messages: [{ body: "hi", createdAt: new Date("2026-11-02"), senderId: "other" }],
    ...over,
  });

  it("shows the other person, newest activity first, and only this user's chats", async () => {
    prisma.conversation.findMany.mockResolvedValue([row({})]);
    expect(await listConversations("u1")).toEqual([{ id: "c1", listingId: 7, listingTitle: "Flat", otherName: "Seller", lastBody: "hi", lastAt: new Date("2026-11-02"), unread: true }]);
    const query = prisma.conversation.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject(participant);
    expect(query.orderBy).toEqual({ lastMessageAt: "desc" });
  });

  it("works out unread from the reader's side", async () => {
    prisma.conversation.findMany.mockResolvedValue([
      row({ buyerReadAt: new Date("2026-11-03") }),
      row({ buyerReadAt: new Date("2026-11-01") }),
      row({ messages: [{ body: "mine", createdAt: new Date("2026-11-02"), senderId: "u1" }] }),
      row({ buyerId: "other", sellerReadAt: new Date("2026-11-03") }),
    ]);
    const rows = await listConversations("u1");
    expect(rows.map((chat) => chat.unread)).toEqual([false, true, false, false]);
    expect(rows[3].otherName).toBe("Buyer");
  });
});

describe("getConversation", () => {
  const thread = {
    id: "c1",
    listingId: 7,
    buyerId: "u1",
    listing: { title: "Flat" },
    buyer: { name: "Buyer" },
    seller: { name: "Seller" },
    messages: [
      { id: "m2", body: "second", senderId: "other", createdAt: new Date("2026-11-02") },
      { id: "m1", body: "first", senderId: "u1", createdAt: new Date("2026-11-01") },
    ],
  };

  it("is closed to anyone outside it", async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    expect(await getConversation("u1", "c1")).toBeNull();
    expect(prisma.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: "c1", ...participant });
    expect(prisma.conversation.updateMany).not.toHaveBeenCalled();
  });

  it("finds nothing for a malformed id without querying", async () => {
    expect(await getConversation("u1", "bad id")).toBeNull();
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
  });

  it("marks read only up to the newest message shown", async () => {
    prisma.conversation.findFirst.mockResolvedValue(structuredClone(thread));
    await getConversation("u1", "c1");
    expect(prisma.conversation.updateMany.mock.calls[0][0].data.buyerReadAt).toEqual(new Date("2026-11-02"));
  });

  it("gives messages oldest first and marks them read for the buyer", async () => {
    prisma.conversation.findFirst.mockResolvedValue(structuredClone(thread));
    const chat = await getConversation("u1", "c1");
    expect(chat?.otherName).toBe("Seller");
    expect(chat?.messages.map((message) => [message.body, message.mine])).toEqual([["first", true], ["second", false]]);
    expect(prisma.conversation.updateMany.mock.calls[0][0].data).toHaveProperty("buyerReadAt");
  });

  it("marks them read for the seller", async () => {
    prisma.conversation.findFirst.mockResolvedValue(structuredClone({ ...thread, buyerId: "other" }));
    expect((await getConversation("u1", "c1"))?.otherName).toBe("Buyer");
    expect(prisma.conversation.updateMany.mock.calls[0][0].data).toHaveProperty("sellerReadAt");
  });
});
