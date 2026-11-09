import type { Dict, Locale } from "./i18n";
import type { Currency, DealType } from "./search";

const symbols: Record<Currency, string> = { USD: "$", GEL: "₾" };

export function formatPrice(value: number, currency: Currency): string {
  return symbols[currency] + new Intl.NumberFormat("en-US").format(value);
}

/** What a price is per, for deals that are not paid once. */
export function priceUnit(deal: DealType, t: Dict): string | undefined {
  const units: Partial<Record<DealType, string>> = { rent: t.perMonth, lease: t.perMonth, daily: t.perDay };
  return units[deal];
}

/** A short date such as "6 Nov", in the page language. */
export function formatDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));
}
