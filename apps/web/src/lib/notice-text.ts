import type { NotificationDetails } from "@mteam/db";
import { formatDay, formatPrice, parseListingFilters, type Dict, type Locale } from "@mteam/shared";
import { searchName } from "./seo";

/** What happened, in a line: the notifications page's text and a push notification's title. */
export function noticeText(notice: NotificationDetails, t: Dict, locale: Locale): string {
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
export function noticeSubject(notice: NotificationDetails, t: Dict, locale: Locale): string {
  if (notice.type !== "SEARCH_MATCHES") return notice.listingTitle;
  return searchName(parseListingFilters(Object.fromEntries(new URLSearchParams(notice.query))), locale) || t.saved.allListings;
}
