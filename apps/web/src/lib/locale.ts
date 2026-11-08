import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@mteam/shared";

/** Returns the locale from the URL, or shows 404 for an unknown one. */
export function resolveLocale(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}
