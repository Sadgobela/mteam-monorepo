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

/** Typical terms for a first estimate. Visitors can change them; the bank sets the real ones. */
export const LOAN_DEFAULTS = { down: 20, years: 20, rate: 11 };

/** The monthly payment on a standard repayment loan, with the deposit as a percentage of the price. */
export function monthlyPayment(price: number, downPercent: number, years: number, ratePercent: number): number {
  const principal = price * (1 - downPercent / 100);
  const months = years * 12;
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = ratePercent / 100 / 12;
  if (monthlyRate === 0) return Math.round(principal / months);
  return Math.round((principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months));
}

/** A phone number with its last three digits hidden. */
export function maskPhone(phone: string): string {
  return phone.replace(/\d(?=(\D*\d){0,2}\D*$)/g, "*");
}

/** A short date such as "6 Nov", in the page language. */
export function formatDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));
}
