// Push notifications to the mobile app: one Expo push token per phone. Sending lives in the web app (apps/web/src/lib/app-push.ts).
import { db } from "./client";
import { MAX_PUSH_SUBSCRIPTIONS } from "./push";

export interface AppPushTarget {
  token: string;
  locale: string;
}

/**
 * Keeps this phone for the user. A phone someone else signed in on before now belongs to this user, so only whoever
 * turned push on last is notified. Over the same limit as browsers, the phones used longest ago are dropped.
 */
export async function saveAppPushToken(userId: string, target: AppPushTarget & { platform: string }): Promise<void> {
  const client = db();
  const fields = { ...target, userId, lastUsedAt: new Date() };
  await client.appPushToken.upsert({ where: { token: target.token }, create: fields, update: fields });
  const over = await client.appPushToken.findMany({ where: { userId }, orderBy: { lastUsedAt: "desc" }, skip: MAX_PUSH_SUBSCRIPTIONS, select: { id: true } });
  if (over.length > 0) await client.appPushToken.deleteMany({ where: { id: { in: over.map((row) => row.id) } } });
}

/** Turns push off for one phone. Only the user's own: the owner check is part of the query. */
export async function deleteAppPushToken(userId: string, token: string): Promise<void> {
  await db().appPushToken.deleteMany({ where: { userId, token } });
}

/** The user's phones to notify: none when they switched push off. */
export function listAppPushTargets(userId: string): Promise<AppPushTarget[]> {
  return db().appPushToken.findMany({ where: { userId, user: { notifyPush: true } }, select: { token: true, locale: true } });
}

/** Phones Expo says can no longer be reached (the app was removed, or push was switched off in the phone's settings). */
export async function deleteExpiredAppPushTokens(tokens: string[]): Promise<void> {
  await db().appPushToken.deleteMany({ where: { token: { in: tokens } } });
}

/** Records a delivery, so the phones still in use are the ones kept at the limit. */
export async function markAppPushTokensUsed(tokens: string[]): Promise<void> {
  await db().appPushToken.updateMany({ where: { token: { in: tokens } }, data: { lastUsedAt: new Date() } });
}
