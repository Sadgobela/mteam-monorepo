import type { Dict, Locale } from "./i18n";
import { cityNames, citySlugs } from "./search";
import type { Listing } from "./types";

/** Districts as owners write them. An unlisted one falls back to the city. A Map, because the key is user input. */
const districtNames = new Map<string, { en: string; ru: string }>([
  ["ვაკე", { en: "Vake", ru: "Ваке" }],
  ["საბურთალო", { en: "Saburtalo", ru: "Сабуртало" }],
  ["ვერა", { en: "Vera", ru: "Вера" }],
  ["მთაწმინდა", { en: "Mtatsminda", ru: "Мтацминда" }],
  ["სოლოლაკი", { en: "Sololaki", ru: "Сололаки" }],
  ["ავლაბარი", { en: "Avlabari", ru: "Авлабари" }],
  ["ორთაჭალა", { en: "Ortachala", ru: "Ортачала" }],
  ["კრწანისი", { en: "Krtsanisi", ru: "Крцаниси" }],
  ["დიდუბე", { en: "Didube", ru: "Дидубе" }],
  ["ჩუღურეთი", { en: "Chugureti", ru: "Чугурети" }],
  ["გლდანი", { en: "Gldani", ru: "Глдани" }],
  ["ნაძალადევი", { en: "Nadzaladevi", ru: "Надзаладеви" }],
  ["ისანი", { en: "Isani", ru: "Исани" }],
  ["სამგორი", { en: "Samgori", ru: "Самгори" }],
  ["დიღომი", { en: "Dighomi", ru: "Дигоми" }],
  ["ვაშლიჯვარი", { en: "Vashlijvari", ru: "Вашлиджвари" }],
  ["ძველი ბათუმი", { en: "Old Batumi", ru: "Старый Батуми" }],
  ["ახალი ბულვარი", { en: "New Boulevard", ru: "Новый бульвар" }],
]);

/** Districts to suggest in search. The value is the stored name, which is what search matches. */
export function districtOptions(locale: Locale): { value: string; label: string }[] {
  return [...districtNames].map(([value, names]) => ({ value, label: locale === "ka" ? value : names[locale] }));
}

/** Where a listing is, in the page language: its district when that can be shown, otherwise its city. */
export function placeName(listing: Pick<Listing, "city" | "district">, locale: Locale, t: Dict): string | undefined {
  const district = listing.district.trim();
  const name = locale === "ka" ? district : districtNames.get(district)?.[locale];
  if (name) return name;
  const city = citySlugs.find((slug) => cityNames[slug] === listing.city);
  return city && t.city[city];
}
