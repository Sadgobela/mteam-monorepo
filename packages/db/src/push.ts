// Push notifications: the browsers each user turned them on for. Sending lives in the web app (apps/web/src/lib/push.ts).
import { db } from "./client";

/** How many browsers one account keeps for push; the one used longest ago makes room for a new one. */
export const MAX_PUSH_SUBSCRIPTIONS = 10;

/** What a push service needs to deliver to one browser, and the language to write in. */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
}

/**
 * Keeps this browser for the user. A browser someone else turned push on in before now belongs to this user, so a shared
 * computer only ever notifies whoever turned it on last. Over the limit, the least recently used browsers are dropped.
 */
export async function savePushSubscription(userId: string, target: PushTarget & { userAgent: string | null }): Promise<void> {
  const client = db();
  const fields = { ...target, userId, lastUsedAt: new Date() };
  await client.pushSubscription.upsert({ where: { endpoint: target.endpoint }, create: fields, update: fields });
  const over = await client.pushSubscription.findMany({ where: { userId }, orderBy: { lastUsedAt: "desc" }, skip: MAX_PUSH_SUBSCRIPTIONS, select: { id: true } });
  if (over.length > 0) await client.pushSubscription.deleteMany({ where: { id: { in: over.map((row) => row.id) } } });
}

/** Turns push off for one browser. Only the user's own: the owner check is part of the query. */
export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db().pushSubscription.deleteMany({ where: { userId, endpoint } });
}

/** The addresses of the user's browsers, so a page can tell whether the one showing it is among them. */
export async function listPushEndpoints(userId: string): Promise<string[]> {
  const rows = await db().pushSubscription.findMany({ where: { userId }, select: { endpoint: true } });
  return rows.map((row) => row.endpoint);
}

/** Where to send the user's notifications: none when they switched push off for every device. */
export async function listPushTargets(userId: string): Promise<PushTarget[]> {
  return db().pushSubscription.findMany({ where: { userId, user: { notifyPush: true } }, select: { endpoint: true, p256dh: true, auth: true, locale: true } });
}

/** Browsers the push service says are gone (unsubscribed, uninstalled or expired) are never tried again. */
export async function deleteExpiredPushSubscriptions(endpoints: string[]): Promise<void> {
  await db().pushSubscription.deleteMany({ where: { endpoint: { in: endpoints } } });
}

/** Records a delivery, so the browsers still in use are the ones kept at the limit. */
export async function markPushSubscriptionsUsed(endpoints: string[]): Promise<void> {
  await db().pushSubscription.updateMany({ where: { endpoint: { in: endpoints } }, data: { lastUsedAt: new Date() } });
}
