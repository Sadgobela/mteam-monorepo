import { convertPrice, formatPrice, placeName, priceUnit, type Dict, type Locale, type PublicListing } from "@mteam/shared";

/** Built from the listing's facts, as on the site, so a card reads in the app's language whatever the owner wrote in. */
export function cardTitle(listing: PublicListing, locale: Locale, t: Dict): string {
  const template = listing.rooms > 0 ? t.card.title : t.card.titleNoRooms;
  const title = template
    .replace("{deal}", t.deal[listing.deal])
    .replace("{rooms}", String(listing.rooms))
    .replace("{type}", t.propertyType[listing.type].toLowerCase());
  return `${title}, ${placeName(listing, locale)}`;
}

/** The price in dollars, with the period for rentals; a lari price is converted at the day's rate. */
export function priceLine(listing: PublicListing, t: Dict, gelPerUsd: number): string {
  const usd = convertPrice(listing.price, listing.currency, "usd", gelPerUsd);
  const unit = priceUnit(listing.deal, t);
  return unit ? `${formatPrice(usd, "USD")} ${unit}` : formatPrice(usd, "USD");
}

/** Area, rooms and floor, each with what it is, for the facts on the listing screen. */
export function factList(listing: PublicListing, t: Dict): { kind: "area" | "rooms" | "floor"; text: string }[] {
  const facts: { kind: "area" | "rooms" | "floor"; text: string }[] = [{ kind: "area", text: `${listing.area} ${t.units.sqm}` }];
  if (listing.rooms > 0) facts.push({ kind: "rooms", text: `${listing.rooms} ${t.units.rooms}` });
  if (listing.floor !== undefined) facts.push({ kind: "floor", text: `${listing.floor}/${listing.floors} ${t.units.floor}` });
  return facts;
}

/** The same facts in one line, as a card shows them under the price. */
export function factsLine(listing: PublicListing, t: Dict): string {
  return factList(listing, t)
    .map((fact) => fact.text)
    .join(" · ");
}

/** The digits WhatsApp wants in its link: the number without the plus. */
export function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

/** Site paths, after the language, that the app has a screen for: the path, and the screen with `$1` for its id. */
const screens: [RegExp, string][] = [
  [/^listings\/(\d+)$/, "/listings/$1"],
  [/^listings\/(\d+)\/edit$/, "/edit/$1"],
  [/^my-listings$/, "/my-listings"],
  [/^messages\/([\w-]+)$/, "/messages/$1"],
  [/^messages$/, "/messages"],
  [/^saved$/, "/saved-searches"],
  [/^brokers$/, "/brokers"],
  [/^brokers\/([\w-]+)$/, "/brokers/$1"],
  [/^branches\/([\w-]+)$/, "/branches/$1"],
  [/^sellers\/([\w-]+)$/, "/sellers/$1"],
  [/^mortgage$/, "/mortgage"],
  // The table opens on Tbilisi sales whatever the site's page was showing.
  [/^prices(\?.*)?$/, "/prices"],
  [/^account\/profile$/, "/profile"],
  [/^account\/settings$/, "/settings"],
];

/**
 * Where a site path from a notification opens: a page the app has (a listing, the user's listings, a chat, a broker…) as
 * its screen, the notifications or a search's filters as a tab; anything else opens the site's page in the browser.
 */
export function routeForPath(path: string): { screen: string } | { tab: string } | { web: string } {
  const rest = /^\/[a-z]{2}\/(.+)$/.exec(path)?.[1];
  if (rest !== undefined) {
    const found = screens.find(([pattern]) => pattern.test(rest));
    if (found) return { screen: rest.replace(found[0], found[1]) };
    if (rest === "account/notifications") return { tab: "/notifications" };
  }
  const search = /^\/[a-z]{2}(\?.*)?$/.exec(path);
  if (search) return { tab: `/${search[1] ?? ""}` };
  return { web: path };
}

/** Georgia only, so chat times read the same for everyone, as on the site. */
const TBILISI = "Asia/Tbilisi";

/** A chat message's time of day, such as "14:05". */
export function chatTime(at: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TBILISI }).format(new Date(at));
}

/** The day a chat message was sent, such as "17 November", for the line above the first message of each day. */
export function chatDay(at: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: TBILISI }).format(new Date(at));
}

/**
 * The initials of a name, for an avatar, as on the site: up to two, from the first two words. Georgian letters stay as
 * they are, since Georgian has no capitals in everyday writing and its uppercase forms would look wrong.
 */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .replace(/[^\u10D0-\u10FF]/g, (letter) => letter.toUpperCase());
}
