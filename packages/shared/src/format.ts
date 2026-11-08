import type { Locale } from "./i18n";
import type { Currency } from "./search";

const symbols: Record<Currency, string> = { USD: "$", GEL: "₾", AED: "AED " };

export function formatPrice(value: number, currency: Currency): string {
  return symbols[currency] + new Intl.NumberFormat("en-US").format(value);
}

/** A short date such as "6 Nov", in the page language. */
export function formatDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));
}
