import { notFound } from "next/navigation";
import { getGelPerUsd, getFavoriteIds, getPublicPerson, listSellerListings } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { Avatar } from "@/components/Avatar";
import { Header } from "@/components/Header";
import { ListingGrid } from "@/components/ListingGrid";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SellerPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = resolveLocale(raw);
  const [listings, seller] = await Promise.all([listSellerListings(id), getPublicPerson(id)]);
  if (listings.length === 0 || !seller) notFound();
  const t = getDictionary(locale);
  const user = await currentUser();
  const favoriteIds = user ? await getFavoriteIds(user.id) : [];
  const gelPerUsd = await getGelPerUsd();
  return (
    <>
      <Header locale={locale} t={t} signedIn={user !== null} />
      <main className="page">
        {seller.name ? (
          <div className="person">
            <Avatar name={seller.name} url={seller.avatarUrl} />
            <div>
              <h1 className="heading">{seller.name}</h1>
              <span className="meta">{t.listing.sellerHeading}</span>
            </div>
          </div>
        ) : (
          <h1 className="heading">{t.listing.sellerHeading}</h1>
        )}
        <ListingGrid listings={listings} locale={locale} t={t} cur="usd" gelPerUsd={gelPerUsd} signedIn={user !== null} favoriteIds={favoriteIds} />
      </main>
    </>
  );
}
