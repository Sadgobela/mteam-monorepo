import type { DisplayCurrency, Dict, Listing, Locale } from "@mteam/shared";
import { FavoriteButton, Heart } from "./FavoriteButton";
import { ListingCard } from "./ListingCard";
import { LoginLink } from "./LoginLink";

export function ListingGrid({
  listings,
  locale,
  t,
  cur,
  gelPerUsd,
  list = false,
  signedIn,
  favoriteIds,
}: {
  listings: Listing[];
  locale: Locale;
  t: Dict;
  cur: DisplayCurrency;
  /** Lari per dollar, for prices shown in the other currency. */
  gelPerUsd: number;
  list?: boolean;
  signedIn: boolean;
  favoriteIds: number[];
}) {
  const labels = { add: t.favorites.add, remove: t.favorites.remove, added: t.feedback.favoriteAdded, removed: t.feedback.favoriteRemoved, failed: t.feedback.failed };
  return (
    <div className={list ? "cards list" : "cards"}>
      {listings.map((listing) => (
        <div key={listing.id} className="card-wrap">
          <ListingCard listing={listing} locale={locale} t={t} cur={cur} gelPerUsd={gelPerUsd} />
          {signedIn ? (
            <FavoriteButton locale={locale} listingId={listing.id} active={favoriteIds.includes(listing.id)} labels={labels} />
          ) : (
            <LoginLink locale={locale} className="fav" label={t.favorites.add}>
              <Heart filled={false} />
            </LoginLink>
          )}
        </div>
      ))}
    </div>
  );
}
