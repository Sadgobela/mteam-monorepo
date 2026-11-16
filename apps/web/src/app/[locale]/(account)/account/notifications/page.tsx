import { redirect } from "next/navigation";
import { listNotifications } from "@mteam/db";
import { formatDay, getDictionary } from "@mteam/shared";
import { EmptyState } from "@/components/EmptyState";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { noticeSubject, noticeText } from "@/lib/notice-text";
import { markAllNotificationsReadAction, openNotificationAction } from "@/lib/notification-actions";
import { currentUser } from "@/lib/session";
import "@/app/notifications.css";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/account/notifications`));
  const t = getDictionary(locale);
  const notices = await listNotifications(user.id);
  return (
    <main className="account-main narrow">
      <div className="notice-bar">
        <h1 className="heading">{t.notifications.heading}</h1>
        {notices.some((notice) => !notice.read) && (
          <form action={markAllNotificationsReadAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="btn ghost">{t.notifications.markAllRead}</button>
          </form>
        )}
      </div>
      {notices.length === 0 && <EmptyState text={t.notifications.empty} />}
      <ul className="notice-list">
        {notices.map((notice) => (
          <li key={notice.id}>
            {/* Opening one marks it read, then follows it. */}
            <form action={openNotificationAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={notice.id} />
              <button type="submit" className={notice.read ? "notice" : "notice unread"}>
                <span className="notice-text">{noticeText(notice, t, locale)}</span>
                <span className="notice-meta">
                  {!notice.read && <span className="notice-new">{t.notifications.unread}</span>}
                  <span>{noticeSubject(notice, t, locale)}</span>
                  <time dateTime={notice.at.toISOString()}>{formatDay(notice.at.toISOString(), locale)}</time>
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
