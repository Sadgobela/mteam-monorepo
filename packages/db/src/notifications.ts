// Track D (notifications), see docs/ACCOUNT_PLAN.md.
import type { NotificationType, Prisma } from "@prisma/client";
import { parseListingFilters } from "@mteam/shared";
import { z } from "zod";
import { db } from "./client";
import { getHiddenIds } from "./hidden";
import { countListings } from "./listings";

const LIST_LIMIT = 50;
const DAY_MS = 24 * 60 * 60_000;
const EXPIRY_WARNING_DAYS = 3;
const KEEP_READ_DAYS = 90;
/** A day and an hour, so a run that starts late does not miss what came between; the dedupe keeps the overlap from being told twice. */
const LOOKBACK_MS = DAY_MS + 60 * 60_000;

/** The one setting that lets each kind of notification through. */
const preference = {
  MESSAGE: "notifyMessages",
  LISTING_APPROVED: "notifyListingUpdates",
  LISTING_REJECTED: "notifyListingUpdates",
  LISTING_EXPIRING: "notifyListingUpdates",
  PRICE_DROP: "notifyPriceDrops",
  SEARCH_MATCHES: "notifySavedSearches",
} as const satisfies Record<NotificationType, keyof Prisma.UserWhereInput>;

/** Users who want this kind of notification. Every notification is created through this filter. */
const wants = (type: NotificationType): Prisma.UserWhereInput => ({ [preference[type]]: true });

async function allows(userId: string, type: NotificationType): Promise<boolean> {
  return (await db().user.count({ where: { id: userId, ...wants(type) } })) > 0;
}

const jsonObject = z.record(z.string(), z.unknown()).catch({});

const aboutListing = { listingId: z.number().int(), listingTitle: z.string() };

const detailsSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("MESSAGE"), ...aboutListing, conversationId: z.string(), count: z.number().int().positive() }),
  z.object({ type: z.enum(["LISTING_APPROVED", "LISTING_REJECTED"]), ...aboutListing }),
  z.object({ type: z.literal("LISTING_EXPIRING"), ...aboutListing, expiresAt: z.iso.datetime() }),
  z.object({ type: z.literal("PRICE_DROP"), ...aboutListing, oldPriceUsd: z.number(), newPriceUsd: z.number() }),
  z.object({ type: z.literal("SEARCH_MATCHES"), savedSearchId: z.string(), query: z.string(), count: z.number().int().positive() }),
]);

/** What a notification is about, by kind: what its text and link need. */
export type NotificationDetails = z.infer<typeof detailsSchema>;

export type NotificationRow = NotificationDetails & { id: string; read: boolean; at: Date };

const detailsSelect = { type: true, listingId: true, conversationId: true, data: true, listing: { select: { title: true } } } as const satisfies Prisma.NotificationSelect;

/** The stored row read back through the schema, so text and links never meet malformed JSON. Null when it does not fit. */
function detailsOf(row: Prisma.NotificationGetPayload<{ select: typeof detailsSelect }>): NotificationDetails | null {
  // The columns go last, so nothing in the JSON can stand in for them.
  const parsed = detailsSchema.safeParse({ ...jsonObject.parse(row.data), type: row.type, conversationId: row.conversationId, listingId: row.listingId, listingTitle: row.listing?.title });
  return parsed.success ? parsed.data : null;
}

/** A notification just created, or bumped by another chat message, for delivery beyond the site. */
export type CreatedNotification = NotificationDetails & { id: string; userId: string };
export type NotificationListener = (created: CreatedNotification[]) => Promise<void>;

/** On globalThis, because the server's start-up code and its routes can each load their own copy of this module. */
const listenerStore = globalThis as typeof globalThis & { mteamNotificationListener?: NotificationListener };

/**
 * Lets the web app deliver notifications elsewhere, such as push to a phone, without this package knowing how. Every
 * notification is created in this file and handed over here once saved; undefined stops it.
 */
export function onNotificationsCreated(listener: NotificationListener | undefined): void {
  listenerStore.mteamNotificationListener = listener;
}

/** Hands what was just saved to the listener. Delivery failing never fails what created the notification. */
async function announce(ids: string[]): Promise<void> {
  const listener = listenerStore.mteamNotificationListener;
  if (!listener || ids.length === 0) return;
  try {
    const rows = await db().notification.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true, ...detailsSelect } });
    await listener(rows.flatMap((row) => {
      const details = detailsOf(row);
      return details ? [{ ...details, id: row.id, userId: row.userId }] : [];
    }));
  } catch (error) {
    console.error(error);
  }
}

/** Saves a batch and returns the new ids, for announcing once the whole nightly run is saved. */
async function createAll(data: Prisma.NotificationCreateManyInput[]): Promise<string[]> {
  const created = await db().notification.createManyAndReturn({ data, select: { id: true } });
  return created.map((row) => row.id);
}

/** For the bell. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  return db().notification.count({ where: { userId, readAt: null } });
}

/** A user's notifications, newest first. */
export async function listNotifications(userId: string): Promise<NotificationRow[]> {
  const rows = await db().notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: { id: true, readAt: true, createdAt: true, ...detailsSelect },
  });
  return rows.flatMap((row) => {
    const details = detailsOf(row);
    return details ? [{ ...details, id: row.id, read: row.readAt !== null, at: row.createdAt }] : [];
  });
}

/** Marks one notification read and says what it points at. Null when it is not this user's. The owner check is part of the query. */
export async function openNotification(userId: string, id: string): Promise<NotificationDetails | null> {
  const client = db();
  await client.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  const row = await client.notification.findFirst({ where: { id, userId }, select: detailsSelect });
  return row && detailsOf(row);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db().notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

/** Once a chat is read, so is its notification. */
export async function markConversationNotificationsRead(userId: string, conversationId: string): Promise<void> {
  await db().notification.updateMany({ where: { userId, readAt: null, type: "MESSAGE", conversationId }, data: { readAt: new Date() } });
}

const messageCount = z.object({ count: z.number().int().positive() }).catch({ count: 1 });

/** A new chat message: one unread notification per chat, moved to the top and counting up, instead of one per message. */
export async function notifyMessage(userId: string, conversationId: string, listingId: number): Promise<void> {
  if (!(await allows(userId, "MESSAGE"))) return;
  const client = db();
  // ponytail: two messages in the same instant can leave two notifications for one chat; a unique index on unread ones fixes it if it shows.
  const unread = await client.notification.findFirst({ where: { userId, readAt: null, type: "MESSAGE", conversationId }, select: { id: true, data: true } });
  if (unread) {
    await client.notification.update({ where: { id: unread.id }, data: { createdAt: new Date(), data: { count: messageCount.parse(unread.data).count + 1 } } });
    await announce([unread.id]);
  } else {
    const { id } = await client.notification.create({ data: { userId, type: "MESSAGE", conversationId, listingId, data: { count: 1 } }, select: { id: true } });
    await announce([id]);
  }
}

/**
 * Tells the owner a listing was published or turned down. Called after the decision is saved; once per decision,
 * so two moderators or a double click do not tell them twice.
 */
export async function notifyListingReviewed(listingId: number, decision: "ACTIVE" | "REJECTED"): Promise<void> {
  const client = db();
  const listing = await client.listing.findUnique({ where: { id: listingId }, select: { ownerId: true, status: true, updatedAt: true } });
  if (listing?.status !== decision) return;
  const type = decision === "ACTIVE" ? "LISTING_APPROVED" : "LISTING_REJECTED";
  if (!(await allows(listing.ownerId, type))) return;
  const told = await client.notification.count({ where: { userId: listing.ownerId, createdAt: { gte: listing.updatedAt }, type, listingId } });
  if (told > 0) return;
  const { id } = await client.notification.create({ data: { userId: listing.ownerId, type, listingId }, select: { id: true } });
  await announce([id]);
}

/** Owners' published listings ending within a few days, told once per expiry date: renewing sets a new one. */
async function notifyExpiring(now: Date): Promise<string[]> {
  const client = db();
  const warnFrom = (expiresAt: Date) => expiresAt.getTime() - EXPIRY_WARNING_DAYS * DAY_MS;
  const listings = await client.listing.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now, lte: new Date(now.getTime() + EXPIRY_WARNING_DAYS * DAY_MS) }, owner: wants("LISTING_EXPIRING") },
    select: { id: true, ownerId: true, expiresAt: true },
  });
  if (listings.length === 0) return [];
  const told = await client.notification.findMany({
    where: { userId: { in: listings.map((listing) => listing.ownerId) }, createdAt: { gte: new Date(now.getTime() - EXPIRY_WARNING_DAYS * DAY_MS) }, type: "LISTING_EXPIRING", listingId: { in: listings.map((listing) => listing.id) } },
    select: { listingId: true, createdAt: true },
  });
  // Told inside this expiry date's warning window; one told before a renewal falls before it.
  const fresh = listings.flatMap(({ id, ownerId, expiresAt }) =>
    expiresAt && !told.some((notice) => notice.listingId === id && notice.createdAt.getTime() >= warnFrom(expiresAt))
      ? [{ userId: ownerId, type: "LISTING_EXPIRING" as const, listingId: id, data: { expiresAt: expiresAt.toISOString() } }]
      : [],
  );
  return createAll(fresh);
}

/** Users whose favourite got cheaper since the last run, told once per change. */
async function notifyPriceDrops(now: Date): Promise<string[]> {
  const client = db();
  const changes = await client.listingPriceChange.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS) }, listing: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    select: { listingId: true, oldPriceUsd: true, newPriceUsd: true, createdAt: true },
  });
  // Several changes in a day count as one, from the first old price to the last new one.
  const drops = new Map<number, { oldPriceUsd: number; newPriceUsd: number; at: Date }>();
  for (const change of changes) {
    drops.set(change.listingId, { oldPriceUsd: drops.get(change.listingId)?.oldPriceUsd ?? change.oldPriceUsd, newPriceUsd: change.newPriceUsd, at: change.createdAt });
  }
  for (const [listingId, drop] of drops) if (drop.newPriceUsd >= drop.oldPriceUsd) drops.delete(listingId);
  if (drops.size === 0) return [];
  const fans = await client.favorite.findMany({ where: { listingId: { in: [...drops.keys()] }, user: wants("PRICE_DROP") }, select: { userId: true, listingId: true } });
  if (fans.length === 0) return [];
  const told = await client.notification.findMany({
    where: { userId: { in: fans.map((fan) => fan.userId) }, createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS) }, type: "PRICE_DROP", listingId: { in: [...drops.keys()] } },
    select: { userId: true, listingId: true, createdAt: true },
  });
  const fresh = [...drops].flatMap(([listingId, { oldPriceUsd, newPriceUsd, at }]) =>
    fans
      .filter((fan) => fan.listingId === listingId && !told.some((notice) => notice.userId === fan.userId && notice.listingId === listingId && notice.createdAt >= at))
      .map(({ userId }) => ({ userId, type: "PRICE_DROP" as const, listingId, data: { oldPriceUsd, newPriceUsd } })),
  );
  return createAll(fresh);
}

const savedSearchOf = z.object({ savedSearchId: z.string() }).catch({ savedSearchId: "" });

/** Saved searches with new published listings since the last run, or since the user last opened them if that is later. */
async function notifySearchMatches(now: Date): Promise<string[]> {
  const client = db();
  const lookbackFrom = new Date(now.getTime() - LOOKBACK_MS);
  // ponytail: one count per saved search, one after another; batch them if the nightly job gets slow.
  const searches = await client.savedSearch.findMany({ where: { user: wants("SEARCH_MATCHES") }, select: { id: true, userId: true, query: true, seenAt: true } });
  if (searches.length === 0) return [];
  const told = await client.notification.findMany({
    where: { userId: { in: [...new Set(searches.map((search) => search.userId))] }, createdAt: { gte: lookbackFrom }, type: "SEARCH_MATCHES" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, data: true },
  });
  const lastTold = new Map(told.map((notice) => [savedSearchOf.parse(notice.data).savedSearchId, notice.createdAt]));
  const hidden = new Map<string, number[]>();
  const fresh: Prisma.NotificationCreateManyInput[] = [];
  for (const { id, userId, query, seenAt } of searches) {
    // A second run on the same day counts from the first one, so nothing is told twice.
    const since = new Date(Math.max(lookbackFrom.getTime(), seenAt.getTime(), lastTold.get(id)?.getTime() ?? 0));
    const hiddenIds = hidden.get(userId) ?? (await getHiddenIds(userId));
    hidden.set(userId, hiddenIds);
    // ponytail: counts by creation date like the saved searches page, so a listing approved a day after it was posted is missed.
    const count = await countListings(parseListingFilters(Object.fromEntries(new URLSearchParams(query))), { since, hiddenIds });
    if (count > 0) fresh.push({ userId, type: "SEARCH_MATCHES", data: { savedSearchId: id, query, count } });
  }
  return createAll(fresh);
}

/** Nightly, after expiry: expiring listings, price drops and saved-search matches. Returns how many were created. Safe to run twice. */
export async function runNightlyNotifications(): Promise<number> {
  const now = new Date();
  const created = [...(await notifyExpiring(now)), ...(await notifyPriceDrops(now)), ...(await notifySearchMatches(now))];
  await db().notification.deleteMany({ where: { readAt: { lt: new Date(now.getTime() - KEEP_READ_DAYS * DAY_MS) } } });
  // Delivered last, so a slow push run never keeps the steps above from finishing.
  await announce(created);
  return created.length;
}
