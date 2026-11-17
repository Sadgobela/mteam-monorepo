"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markAllNotificationsRead, openNotification } from "@mteam/db";
import { z } from "zod";
import { resolveLocale } from "./locale";
import { noticeTarget } from "./notice-target";
import { currentUser, signInHere } from "./session";

const idSchema = z.string().regex(/^[\w-]{1,40}$/).catch("");

/** The signed-in user and the language, or off to the sign-in page. */
async function signedIn(form: FormData) {
  const locale = resolveLocale(String(form.get("locale")));
  const user = await currentUser();
  if (!user) redirect(await signInHere(locale));
  return { locale, user };
}

/** Marks one notification read and follows it. Someone else's id leads back to the list. */
export async function openNotificationAction(form: FormData): Promise<void> {
  const { locale, user } = await signedIn(form);
  const notice = await openNotification(user.id, idSchema.parse(form.get("id")));
  revalidatePath("/", "layout");
  redirect(notice ? await noticeTarget(user.id, locale, notice) : `/${locale}/account/notifications`);
}

export async function markAllNotificationsReadAction(form: FormData): Promise<void> {
  const { user } = await signedIn(form);
  await markAllNotificationsRead(user.id);
  revalidatePath("/", "layout");
}
