import { redirect } from "next/navigation";
import { listNotifications, type NotificationRow } from "@mteam/db";
import { formatDay, formatPrice, getDictionary, parseListingFilters, type Dict, type Locale } from "@mteam/shared";
import { EmptyState } from "@/components/EmptyState";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { markAllNotificationsReadAction, openNotificationAction } from "@/lib/notification-actions";
import { searchName } from "@/lib/seo";
import { currentUser } from "@/lib/session";
import "@/app/notifications.css";

export const dynamic = "force-dynamic";

function text(notice: NotificationRow, t: Dict, locale: Locale): string {
  const copy = t.notifications;
  switch (notice.type) {
    case "MESSAGE":
      return copy.message.replace("{count}", String(notice.count));
    case "LISTING_APPROVED":
      return copy.approved;
    case "LISTING_REJECTED":
      return copy.rejected;
    case "LISTING_EXPIRING":
      return copy.expiring.replace("{date}", formatDay(notice.expiresAt, locale));
    case "PRICE_DROP":
      return copy.priceDrop.replace("{old}", formatPrice(notice.oldPriceUsd, "USD")).replace("{new}", formatPrice(notice.newPriceUsd, "USD"));
    case "SEARCH_MATCHES":
      return copy.searchMatches.replace("{count}", String(notice.count));
  }
}

/** What it is about: the listing, or the saved search by name. */
function subject(notice: NotificationRow, t: Dict, locale: Locale): string {
  if (notice.type !== "SEARCH_MATCHES") return notice.listingTitle;
  return searchName(parseListingFilters(Object.fromEntries(new URLSearchParams(notice.query))), locale) || t.saved.allListings;
}

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
                <span className="notice-text">{text(notice, t, locale)}</span>
                <span className="notice-meta">
                  {!notice.read && <span className="notice-new">{t.notifications.unread}</span>}
                  <span>{subject(notice, t, locale)}</span>
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
