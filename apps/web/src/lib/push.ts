import webpush from "web-push";
import { z } from "zod";
import { deleteExpiredPushSubscriptions, listPushTargets, markPushSubscriptionsUsed, onNotificationsCreated, type CreatedNotification } from "@mteam/db";
import { defaultLocale, getDictionary, isLocale, type Locale } from "@mteam/shared";
import { noticeSubject, noticeText } from "./notice-text";

/** The site's key pair for push services (npx web-push generate-vapid-keys) and a contact they can reach. */
const envSchema = z.object({
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/),
});

/** A day: news older than that is waiting on the site anyway. */
const TTL_SECONDS = 24 * 60 * 60;
const TIMEOUT_MS = 10_000;

/** How a push service says this browser will never take a message again: unsubscribed, uninstalled or expired. */
const GONE = new Set([404, 410]);
const failureSchema = z.object({ statusCode: z.number() });

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const vapid = () => envSchema.safeParse(process.env).data ?? null;

/** The key browsers subscribe with, or null when push is not set up and the site goes on without it. */
export function vapidPublicKey(): string | null {
  return vapid()?.VAPID_PUBLIC_KEY ?? null;
}

/** Where tapping the notification leads. Unlike opening it on the notifications page, nothing is marked seen at send time. */
function pushPath(notice: CreatedNotification, locale: Locale): string {
  switch (notice.type) {
    case "MESSAGE":
      return `/${locale}/messages/${notice.conversationId}`;
    case "LISTING_APPROVED":
    case "PRICE_DROP":
      return `/${locale}/listings/${notice.listingId}`;
    case "LISTING_REJECTED":
    case "LISTING_EXPIRING":
      return `/${locale}/my-listings`;
    case "SEARCH_MATCHES":
      return `/${locale}?${notice.query}`;
  }
}

/**
 * What the service worker shows, in the language of the page that turned push on: the notifications page's line as the
 * title and what it is about as the body. The tag is the notification's id, so a chat bumped by more messages replaces
 * its notification instead of piling up.
 */
export function pushMessage(notice: CreatedNotification, language: string): PushMessage {
  const locale = isLocale(language) ? language : defaultLocale;
  const t = getDictionary(locale);
  return { title: noticeText(notice, t, locale), body: noticeSubject(notice, t, locale), url: pushPath(notice, locale), tag: notice.id };
}

async function deliver(notices: CreatedNotification[]): Promise<void> {
  const env = vapid();
  if (!env) return;
  const vapidDetails = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  // ponytail: one user after another, each user's browsers at once, awaited inside the request; a queue if the nightly run gets slow.
  for (const notice of notices) {
    const targets = await listPushTargets(notice.userId);
    const results = await Promise.allSettled(
      targets.map((target) =>
        webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(pushMessage(notice, target.locale)), {
          vapidDetails,
          TTL: TTL_SECONDS,
          timeout: TIMEOUT_MS,
        }),
      ),
    );
    const sent: string[] = [];
    const gone: string[] = [];
    results.forEach((result, index) => {
      const { endpoint } = targets[index];
      if (result.status === "fulfilled") sent.push(endpoint);
      else if (GONE.has(failureSchema.safeParse(result.reason).data?.statusCode ?? 0)) gone.push(endpoint);
      else console.error(result.reason);
    });
    if (gone.length > 0) await deleteExpiredPushSubscriptions(gone);
    if (sent.length > 0) await markPushSubscriptionsUsed(sent);
  }
}

/** Pushes notifications just created to their users' browsers. Without VAPID keys it does nothing, and it never throws. */
export async function sendPush(notices: CreatedNotification[]): Promise<void> {
  try {
    await deliver(notices);
  } catch (error) {
    console.error(error);
  }
}

/** Called once at server start: every notification saved from then on is also pushed. */
export function registerPush(): void {
  onNotificationsCreated(sendPush);
}
