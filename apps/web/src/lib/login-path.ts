import { locales, type Locale } from "@mteam/shared";

const OWN_PAGE = new RegExp(`^/(${locales.join("|")})(?:[/?#]|$)`);

/** Where to go after signing in: one of our own pages, never another site. Anything else goes home. */
export function safeNext(value: unknown, locale: Locale): string {
  return typeof value === "string" && OWN_PAGE.test(value) && !/\/\/|\\|\s/.test(value) ? value : `/${locale}`;
}

/** The sign-in page, coming back to `next` afterwards. */
export const loginPath = (locale: Locale, next: string) => `/${locale}/login?next=${encodeURIComponent(next)}`;
