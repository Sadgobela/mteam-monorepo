import { notFound } from "next/navigation";
import { getFavoriteIds, listSellerListings } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { ListingGrid } from "@/components/ListingGrid";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SellerPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = resolveLocale(raw);
  const listings = await listSellerListings(id);
  if (listings.length === 0) notFound();
  const t = getDictionary(locale);
  const user = await currentUser();
  const favoriteIds = user ? await getFavoriteIds(user.id) : [];
  return (
    <>
      <Header locale={locale} t={t} signedIn={user !== null} />
      <main className="page">
        <h1 className="heading">{t.listing.sellerHeading}</h1>
        <ListingGrid listings={listings} locale={locale} t={t} cur="usd" signedIn={user !== null} favoriteIds={favoriteIds} />
      </main>
    </>
  );
}
