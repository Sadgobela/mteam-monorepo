import Image from "next/image";
import Link from "next/link";
import { formatPrice, type Dict, type Listing, type Locale } from "@mteam/shared";

export function ListingCard({ listing, locale, t }: { listing: Listing; locale: Locale; t: Dict }) {
  const floor = listing.floor ? ` · ${listing.floor}/${listing.floors} ${t.units.floor}` : "";
  return (
    <Link href={`/${locale}/listings/${listing.id}`} className="card">
      <div className={`ph ${listing.tone}`}>
        {listing.images[0] && <Image src={listing.images[0]} alt={listing.title} fill unoptimized />}
        {listing.verified && (
          <span className="badge">
            <i />
            mTeam Verified
          </span>
        )}
        <span className="tag">{t.deal[listing.deal]}</span>
      </div>
      <div className="cbody">
        <span className="price">
          {formatPrice(listing.price, listing.currency)}
          {listing.deal === "rent" && <small className="meta"> {t.perMonth}</small>}
        </span>
        <span className="addr">
          {listing.address}, {listing.district}
        </span>
        <span className="meta">
          {listing.rooms > 0 && `${listing.rooms} ${t.units.rooms} · `}
          {listing.area} {t.units.sqm}
          {floor}
        </span>
      </div>
    </Link>
  );
}
