import Link from "next/link";
import type { DisplayCurrency, Dict, Listing, Locale } from "@mteam/shared";
import { toggleFavoriteAction } from "@/lib/account-actions";
import { ListingCard } from "./ListingCard";

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20s-7-4.5-9-9a4.8 4.8 0 0 1 9-2.5A4.8 4.8 0 0 1 21 11c-2 4.5-9 9-9 9z" />
    </svg>
  );
}

export function ListingGrid({
  listings,
  locale,
  t,
  cur,
  list = false,
  signedIn,
  favoriteIds,
}: {
  listings: Listing[];
  locale: Locale;
  t: Dict;
  cur: DisplayCurrency;
  list?: boolean;
  signedIn: boolean;
  favoriteIds: number[];
}) {
  return (
    <div className={list ? "cards list" : "cards"}>
      {listings.map((listing) => {
        const active = favoriteIds.includes(listing.id);
        return (
          <div key={listing.id} className="card-wrap">
            <ListingCard listing={listing} locale={locale} t={t} cur={cur} />
            {signedIn ? (
              <form action={toggleFavoriteAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="listingId" value={listing.id} />
                <button type="submit" className="fav" aria-pressed={active} aria-label={active ? t.favorites.remove : t.favorites.add}>
                  <Heart filled={active} />
                </button>
              </form>
            ) : (
              <Link href={`/${locale}/login`} className="fav" aria-label={t.favorites.add}>
                <Heart filled={false} />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
