import { redirect } from "next/navigation";
import { getGelPerUsd, listFavorites } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { EmptyState } from "@/components/EmptyState";
import { ListingGrid } from "@/components/ListingGrid";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";
import { loginPath } from "@/lib/login-path";

export const dynamic = "force-dynamic";

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/favorites`));
  const t = getDictionary(locale);
  const listings = await listFavorites(user.id);
  const gelPerUsd = await getGelPerUsd();
  return (
    <>
      <main className="account-main">
        <h1 className="heading">{t.favorites.heading}</h1>
        {listings.length === 0 ? (
          <EmptyState text={t.favorites.empty} />
        ) : (
          <ListingGrid listings={listings} locale={locale} t={t} cur="usd" gelPerUsd={gelPerUsd} signedIn favoriteIds={listings.map((l) => l.id)} />
        )}
      </main>
    </>
  );
}
