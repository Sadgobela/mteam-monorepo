import type { Currency } from "./search";

const symbols: Record<Currency, string> = { USD: "$", GEL: "₾", AED: "AED " };

export function formatPrice(value: number, currency: Currency): string {
  return symbols[currency] + new Intl.NumberFormat("en-US").format(value);
}
