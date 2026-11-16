"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markAllNotificationsRead, openNotification, openSavedSearch, type NotificationDetails } from "@mteam/db";
import type { Locale } from "@mteam/shared";
import { z } from "zod";
import { resolveLocale } from "./locale";
import { currentUser, signInHere } from "./session";

const idSchema = z.string().regex(/^[\w-]{1,40}$/).catch("");

/** The signed-in user and the language, or off to the sign-in page. */
async function signedIn(form: FormData) {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  return { locale, user };
}

/** Where a notification leads, from the stored row, never from the form. A saved search is opened, which counts its results as seen. */
async function target(userId: string, locale: Locale, notice: NotificationDetails): Promise<string> {
  switch (notice.type) {
    case "MESSAGE":
      return `/${locale}/messages/${notice.conversationId}`;
    case "LISTING_APPROVED":
    case "PRICE_DROP":
      return `/${locale}/listings/${notice.listingId}`;
    case "LISTING_REJECTED":
    case "LISTING_EXPIRING":
      return `/${locale}/my-listings`;
    case "SEARCH_MATCHES": {
      const query = await openSavedSearch(userId, notice.savedSearchId);
      return query === null ? `/${locale}/saved` : `/${locale}?${query}`;
    }
  }
}

/** Marks one notification read and follows it. Someone else's id leads back to the list. */
export async function openNotificationAction(form: FormData): Promise<void> {
  const { locale, user } = await signedIn(form);
  const notice = await openNotification(user.id, idSchema.parse(form.get("id")));
  revalidatePath("/", "layout");
  redirect(notice ? await target(user.id, locale, notice) : `/${locale}/account/notifications`);
}

export async function markAllNotificationsReadAction(form: FormData): Promise<void> {
  const { user } = await signedIn(form);
  await markAllNotificationsRead(user.id);
  revalidatePath("/", "layout");
}
