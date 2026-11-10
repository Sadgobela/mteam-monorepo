import { db } from "./client";

const LIST_LIMIT = 50;
const THREAD_LIMIT = 200;
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
const MESSAGES_PER_HOUR = 60;
const NEW_CHATS_PER_DAY = 20;

export interface ConversationRow {
  id: string;
  listingId: number;
  listingTitle: string;
  otherName: string | null;
  lastBody: string;
  lastAt: Date;
  unread: boolean;
}

export interface ThreadMessage {
  id: string;
  body: string;
  mine: boolean;
  at: Date;
}

const sellerFields = { ownerId: true, agent: { select: { userId: true, user: { select: { role: true } } } } } as const;
type SellerFields = { ownerId: string; agent: { userId: string; user: { role: string } } | null };

/** The same rule as the public phone number: a broker only answers while they are a broker. */
const currentSeller = (listing: SellerFields) => (listing.agent?.user.role === "AGENT" ? listing.agent.userId : listing.ownerId);

/** Slows down one account sending spam. A slightly racy count is fine for that. */
async function canSend(userId: string): Promise<boolean> {
  return (await db().message.count({ where: { senderId: userId, createdAt: { gte: new Date(Date.now() - HOUR_MS) } } })) < MESSAGES_PER_HOUR;
}

/** Opens a chat about a published listing, or continues the one this buyer already has. Null when it cannot be sent. */
export async function startConversation(buyerId: string, listingId: number, body: string): Promise<string | null> {
  const client = db();
  const listing = await client.listing.findFirst({
    where: { id: listingId, status: "ACTIVE" },
    select: sellerFields,
  });
  if (!listing) return null;
  const sellerId = currentSeller(listing);
  if (sellerId === buyerId || !(await canSend(buyerId))) return null;
  const existing = await client.conversation.findUnique({ where: { listingId_buyerId: { listingId, buyerId } }, select: { id: true } });
  if (!existing && (await client.conversation.count({ where: { buyerId, createdAt: { gte: new Date(Date.now() - DAY_MS) } } })) >= NEW_CHATS_PER_DAY) return null;
  const { id } = await client.conversation.upsert({
    where: { listingId_buyerId: { listingId, buyerId } },
    create: { listingId, buyerId, sellerId, buyerReadAt: new Date() },
    update: { sellerId, buyerReadAt: new Date(), lastMessageAt: new Date() },
    select: { id: true },
  });
  await client.message.create({ data: { conversationId: id, senderId: buyerId, body } });
  return id;
}

/** Only someone in the chat can write in it. */
export async function sendMessage(userId: string, conversationId: string, body: string): Promise<boolean> {
  const client = db();
  const conversation = await client.conversation.findFirst({
    where: { id: conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: { buyerId: true, listing: { select: sellerFields } },
  });
  if (!conversation) return false;
  // Whoever answers for the listing now, so a broker who left drops out and the owner picks up the chat.
  const sellerId = currentSeller(conversation.listing);
  const amBuyer = conversation.buyerId === userId;
  if ((!amBuyer && userId !== sellerId) || !(await canSend(userId))) return false;
  await client.message.create({ data: { conversationId, senderId: userId, body } });
  await client.conversation.update({ where: { id: conversationId }, data: { ...(amBuyer ? { buyerReadAt: new Date() } : { sellerReadAt: new Date() }), sellerId, lastMessageAt: new Date() } });
  return true;
}

/** A user's chats, the latest activity first. Names only: phone numbers stay out of chat. */
export async function listConversations(userId: string): Promise<ConversationRow[]> {
  const rows = await db().conversation.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }], messages: { some: {} } },
    select: {
      id: true,
      listingId: true,
      buyerId: true,
      buyerReadAt: true,
      sellerReadAt: true,
      listing: { select: { title: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true, senderId: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: LIST_LIMIT,
  });
  return rows.map((row) => {
    const amBuyer = row.buyerId === userId;
    const readAt = amBuyer ? row.buyerReadAt : row.sellerReadAt;
    const [last] = row.messages;
    return {
      id: row.id,
      listingId: row.listingId,
      listingTitle: row.listing.title,
      otherName: amBuyer ? row.seller.name : row.buyer.name,
      lastBody: last.body,
      lastAt: last.createdAt,
      unread: last.senderId !== userId && (readAt === null || last.createdAt > readAt),
    };
  });
}

/** One chat, oldest message first, marked as read for this user. Null unless they are in it. */
export async function getConversation(userId: string, id: string) {
  if (!/^[\w-]{1,40}$/.test(id)) return null;
  const client = db();
  const row = await client.conversation.findFirst({
    where: { id, OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: {
      id: true,
      listingId: true,
      buyerId: true,
      listing: { select: { title: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: THREAD_LIMIT, select: { id: true, body: true, senderId: true, createdAt: true } },
    },
  });
  if (!row) return null;
  const amBuyer = row.buyerId === userId;
  // Up to the newest message actually shown, so one arriving this instant still counts as new.
  const shownUpTo = row.messages[0]?.createdAt;
  await client.conversation.updateMany({ where: { id }, data: amBuyer ? { buyerReadAt: shownUpTo } : { sellerReadAt: shownUpTo } });
  const messages: ThreadMessage[] = row.messages.reverse().map((message) => ({ id: message.id, body: message.body, mine: message.senderId === userId, at: message.createdAt }));
  return { id: row.id, listingId: row.listingId, listingTitle: row.listing.title, otherName: amBuyer ? row.seller.name : row.buyer.name, messages };
}
