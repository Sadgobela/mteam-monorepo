import type { Locale } from "@mteam/shared";

export type Query = Record<string, string | string[] | undefined>;

/** The current results URL with some parameters changed, so filters survive switching sort, view or page. */
export function resultsHref(locale: Locale, query: Query, change: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...change })) {
    if (typeof value === "string") params.set(key, value);
  }
  const search = params.toString();
  return search ? `/${locale}?${search}` : `/${locale}`;
}
