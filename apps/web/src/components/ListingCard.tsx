import Image from "next/image";
import Link from "next/link";
import { convertPrice, formatPrice, type DisplayCurrency, type Dict, type Listing, type Locale } from "@mteam/shared";

/** Built from the listing's facts, so a card reads in the page language whatever language the owner wrote in. */
function cardTitle(listing: Listing, t: Dict): string {
  const template = listing.rooms > 0 ? t.card.title : t.card.titleNoRooms;
  return template
    .replace("{deal}", t.deal[listing.deal])
    .replace("{rooms}", String(listing.rooms))
    .replace("{type}", t.propertyType[listing.type].toLowerCase());
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
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(listing.updatedAt),
  );
  return (
    <Link href={`/${locale}/listings/${listing.id}`} className="card">
      <div className={`ph ${listing.tone}`}>
        {listing.images[0] && <Image src={listing.images[0]} alt={listing.title} fill unoptimized />}
        {listing.verified && (
          <span className="badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            mTeam Verified
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
            {listing.deal === "rent" && <small className="meta"> {t.perMonth}</small>}
          </span>
          {listing.deal === "sale" && (
            <span className="meta">
              {formatPrice(Math.round(shown / listing.area), currency)} / {t.units.sqm}
            </span>
          )}
        </div>
        <h2 className="ctitle">{cardTitle(listing, t)}</h2>
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
        <div className="cfoot meta">
          <span>
            {listing.address}, {listing.district}
          </span>
          <span>{date}</span>
        </div>
      </div>
    </Link>
  );
}
