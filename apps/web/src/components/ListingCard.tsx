import Link from "next/link";
import { CardPhotos } from "./CardPhotos";
import { priceUnit, convertPrice, formatDay, formatPrice, placeName, type DisplayCurrency, type Dict, type Listing, type Locale } from "@mteam/shared";

/** Built from the listing's facts, so a card reads in the page language whatever language the owner wrote in. */
export function cardTitle(listing: Listing, locale: Locale, t: Dict): string {
  const template = listing.rooms > 0 ? t.card.title : t.card.titleNoRooms;
  const title = template
    .replace("{deal}", t.deal[listing.deal])
    .replace("{rooms}", String(listing.rooms))
    .replace("{type}", t.propertyType[listing.type].toLowerCase());
  // After a comma, because "in Vake" would need a different grammatical case for every place in Georgian and Russian.
  return `${title}, ${placeName(listing, locale)}`;
}

export function ListingCard({
  listing,
  locale,
  t,
  cur = "usd",
  gelPerUsd,
}: {
  listing: Listing;
  locale: Locale;
  t: Dict;
  cur?: DisplayCurrency;
  gelPerUsd: number;
}) {
  const shown = convertPrice(listing.price, listing.currency, cur, gelPerUsd);
  const currency = cur === "gel" ? "GEL" : "USD";
  const unit = priceUnit(listing.deal, t);
  return (
    <Link href={`/${locale}/listings/${listing.id}${cur === "gel" ? "?cur=gel" : ""}`} className="card">
      <div className={`ph ${listing.tone}`}>
        {listing.images.length > 0 && <CardPhotos images={listing.images.slice(0, 5)} alt={listing.title} />}
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
            {listing.images.length} {listing.images.length === 1 ? t.card.photo : t.card.photos}
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
        <p className="caddr meta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span>{[listing.address, listing.district].filter(Boolean).join(", ") || placeName(listing, locale)}</span>
        </p>
        {/* One line in every card, so the rows line up. The floor comes before bedrooms, so bedrooms are what a narrow card leaves out. */}
        <p className="cfacts">
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
          {listing.bedrooms && (
            <span>
              {listing.bedrooms} {t.units.bedrooms}
            </span>
          )}
        </p>
        <div className="cfoot meta">
          {listing.agent?.name ? (
            <span className="cbroker">
              <i aria-hidden="true">{listing.agent.name.slice(0, 1)}</i>
              <span>{listing.agent.name}</span>
            </span>
          ) : (
            <span />
          )}
          <time dateTime={listing.updatedAt}>{formatDay(listing.updatedAt, locale)}</time>
        </div>
      </div>
    </Link>
  );
}
