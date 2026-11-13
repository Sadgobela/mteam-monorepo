import type { Locale } from "@mteam/shared";

/** The sign-in page, coming back to `next` afterwards. */
export const loginPath = (locale: Locale, next: string) => `/${locale}/login?next=${encodeURIComponent(next)}`;
