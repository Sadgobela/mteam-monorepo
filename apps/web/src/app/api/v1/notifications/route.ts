import { NextResponse } from "next/server";
import { countUnreadNotifications, listNotifications, markAllNotificationsRead } from "@mteam/db";
import { defaultLocale, getDictionary, isLocale } from "@mteam/shared";
import { fail } from "@/lib/api";
import { noticeSubject, noticeText } from "@/lib/notice-text";
import { currentUser } from "@/lib/session";

/**
 * The user's notifications, newest first, written in the app's language (`?locale=`) as on the site's notifications page:
 * what it is about as the title, what happened as the body. `unread` is the number for the badge.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  const asked = new URL(request.url).searchParams.get("locale") ?? "";
  const locale = isLocale(asked) ? asked : defaultLocale;
  const t = getDictionary(locale);
  const [rows, unread] = await Promise.all([listNotifications(user.id), countUnreadNotifications(user.id)]);
  return NextResponse.json({
    notifications: rows.map((row) => ({ id: row.id, read: row.read, at: row.at.toISOString(), title: noticeSubject(row, t, locale), body: noticeText(row, t, locale) })),
    unread,
  });
}

/** Marks them all read. */
export async function POST() {
  const user = await currentUser();
  if (!user) return fail("signedOut", 401);
  await markAllNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
}
