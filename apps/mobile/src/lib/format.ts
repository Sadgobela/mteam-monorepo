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

/** Area, rooms and floor, the facts a card shows under the price. */
export function factsLine(listing: PublicListing, t: Dict): string {
  const facts = [`${listing.area} ${t.units.sqm}`];
  if (listing.rooms > 0) facts.push(`${listing.rooms} ${t.units.rooms}`);
  if (listing.floor !== undefined) facts.push(`${listing.floor}/${listing.floors} ${t.units.floor}`);
  return facts.join(" · ");
}

/** The digits WhatsApp wants in its link: the number without the plus. */
export function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

/**
 * The screen a site path from a notification opens: a listing, or the user's listings for news about their own; anything
 * else (messages, saved searches) opens the site's page in the browser until the app has those screens.
 */
export function routeForPath(path: string): { screen: string } | { web: string } {
  const listing = /^\/[a-z]{2}\/listings\/(\d+)$/.exec(path);
  if (listing) return { screen: `/listings/${listing[1]}` };
  if (/^\/[a-z]{2}\/my-listings$/.test(path)) return { screen: "/my-listings" };
  return { web: path };
}
