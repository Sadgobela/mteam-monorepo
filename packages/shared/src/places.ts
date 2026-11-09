import { georgia, POPULAR_CITIES } from "./geo";
import type { Locale } from "./i18n";
import type { Listing } from "./types";

export const cities = georgia.map(([name]) => name);
export const popularCities = cities.slice(0, POPULAR_CITIES);

const areasByCity = new Map(georgia);

export function isCity(name: string): boolean {
  return areasByCity.has(name);
}

/** A city's areas. An area with one district of its own name is a plain district rather than a group. */
export function cityAreas(city: string): { name: string; districts: string[] }[] {
  return (areasByCity.get(city) ?? []).map((area) => (typeof area === "string" ? { name: area, districts: [area] } : { name: area[0], districts: area[1] }));
}

export function cityDistricts(city: string): string[] {
  return cityAreas(city).flatMap((area) => area.districts);
}

const GEORGIAN = "აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ";
const table = (letters: string) => {
  const sounds = letters.split(" ");
  return new Map([...GEORGIAN].map((letter, index) => [letter, sounds[index]]));
};
const alphabets = {
  en: table("a b g d e v z t i k l m n o p zh r s t u p k gh q sh ch ts dz ts ch kh j h"),
  ru: table("а б г д е в з т и к л м н о п ж р с т у п к г к ш ч ц дз ц ч х дж х"),
};
const adminWords = { en: { municipality: "Municipality", district: "District" }, ru: { municipality: "муниципалитет", district: "район" } };

/** A place name in the page language. There are thousands, so English and Russian are spelled out letter by letter. */
export function placeLabel(name: string, locale: Locale): string {
  if (locale === "ka") return name;
  const words = adminWords[locale];
  const spelled = [...name.replace("მუნიციპალიტეტი", words.municipality).replace("რაიონი", words.district)].map((c) => alphabets[locale].get(c) ?? c).join("");
  return spelled.replace(/(^|[\s(-])(\p{L})/gu, (_, before: string, first: string) => before + first.toUpperCase());
}

/** Where a listing is, in the page language: its district, or its city when it has none. */
export function placeName(listing: Pick<Listing, "city" | "district">, locale: Locale): string {
  return placeLabel(listing.district.trim() || listing.city, locale);
}
