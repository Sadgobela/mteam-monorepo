import { notFound } from "next/navigation";
import { getBranch, getFavoriteIds } from "@mteam/db";
import { getDictionary, placeLabel } from "@mteam/shared";
import { BrokerTiles } from "@/components/BrokerTiles";
import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { ListingGrid } from "@/components/ListingGrid";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BranchPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = resolveLocale(raw);
  const branch = await getBranch(id);
  if (!branch) notFound();
  const t = getDictionary(locale);
  const user = await currentUser();
  const favoriteIds = user ? await getFavoriteIds(user.id) : [];
  return (
    <>
      <Header locale={locale} t={t} signedIn={user !== null} />
      <main className="page">
        <div>
          <h1 className="heading">{branch.name}</h1>
          <div className="meta">{placeLabel(branch.city, locale)}</div>
        </div>
        <h2 className="subheading">{t.brokers.team}</h2>
        <BrokerTiles brokers={branch.brokers} locale={locale} t={t} />
        {branch.listings.length === 0 ? (
          <EmptyState text={t.search.empty} />
        ) : (
          <ListingGrid listings={branch.listings} locale={locale} t={t} cur="usd" signedIn={user !== null} favoriteIds={favoriteIds} />
        )}
      </main>
    </>
  );
}
