import Image from "next/image";
import Link from "next/link";
import { priceUnit, convertPrice, formatDay, formatPrice, placeName, type DisplayCurrency, type Dict, type Listing, type Locale } from "@mteam/shared";

/** Built from the listing's facts, so a card reads in the page language whatever language the owner wrote in. */
function cardTitle(listing: Listing, locale: Locale, t: Dict): string {
  const template = listing.rooms > 0 ? t.card.title : t.card.titleNoRooms;
  const title = template
    .replace("{deal}", t.deal[listing.deal])
    .replace("{rooms}", String(listing.rooms))
    .replace("{type}", t.propertyType[listing.type].toLowerCase());
  // After a comma, because "in Vake" would need a different grammatical case for every place in Georgian and Russian.
  const place = placeName(listing, locale, t);
  return place ? `${title}, ${place}` : title;
}

export function ListingCard({
  listing,
  locale,
  t,
  cur = "usd",
}: {
  listing: Listing;
  locale: Locale;
  t: Dict;
  cur?: DisplayCurrency;
}) {
  const shown = convertPrice(listing.price, listing.currency, cur);
  const currency = cur === "gel" ? "GEL" : "USD";
  const unit = priceUnit(listing.deal, t);
  return (
    <Link href={`/${locale}/listings/${listing.id}${cur === "gel" ? "?cur=gel" : ""}`} className="card">
      <div className={`ph ${listing.tone}`}>
        {listing.images[0] && <Image src={listing.images[0]} alt={listing.title} fill unoptimized />}
        {listing.verified && (
          <span className="badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            MTeam Verified
          </span>
        )}
        {listing.verification && (
          <span className="checked">
            {t.listing.checkedBy.replace("{name}", listing.verification.by).replace("{date}", formatDay(listing.verification.at, locale))}
          </span>
        )}
        {listing.images.length > 0 && (
          <span className="count">
            {listing.images.length} {t.card.photos}
          </span>
        )}
      </div>
      <div className="cbody">
        <div className="cprice">
          <span className="price">
            {formatPrice(shown, currency)}
            {unit && <small className="meta"> {unit}</small>}
          </span>
          {listing.deal === "sale" && (
            <span className="meta">
              {formatPrice(Math.round(shown / listing.area), currency)} / {t.units.sqm}
            </span>
          )}
        </div>
        <h2 className="ctitle">{cardTitle(listing, locale, t)}</h2>
        <div className="cfacts">
          <span>
            {listing.area} {t.units.sqm}
          </span>
          {listing.rooms > 0 && (
            <span>
              {listing.rooms} {t.units.rooms}
            </span>
          )}
          {listing.floor && (
            <span>
              {listing.floor}/{listing.floors} {t.units.floor}
            </span>
          )}
        </div>
        {listing.agent?.name && (
          <span className="cbroker">
            <i aria-hidden="true">{listing.agent.name.slice(0, 1)}</i>
            {listing.agent.name}
          </span>
        )}
        <div className="cfoot meta">
          <span>
            {listing.address}, {listing.district}
          </span>
          <span>{formatDay(listing.updatedAt, locale)}</span>
        </div>
      </div>
    </Link>
  );
}
