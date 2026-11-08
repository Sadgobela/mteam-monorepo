import { redirect } from "next/navigation";
import { listFavorites } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { ListingGrid } from "@/components/ListingGrid";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = getDictionary(locale);
  const listings = await listFavorites(user.id);
  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="page">
        <h1 className="heading">{t.favorites.heading}</h1>
        {listings.length === 0 ? (
          <p className="meta">{t.favorites.empty}</p>
        ) : (
          <ListingGrid listings={listings} locale={locale} t={t} cur="usd" signedIn favoriteIds={listings.map((l) => l.id)} />
        )}
      </main>
    </>
  );
}
