import { openSavedSearch, type NotificationDetails } from "@mteam/db";
import type { Locale } from "@mteam/shared";

/** Where a notification leads, from the stored row, never from the request. A saved search is opened, which counts its results as seen. */
export async function noticeTarget(userId: string, locale: Locale, notice: NotificationDetails): Promise<string> {
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
