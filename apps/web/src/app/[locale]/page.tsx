import { countActiveListings, searchListings } from "@mteam/db";
import { getDictionary, parseListingFilters } from "@mteam/shared";
import { Header } from "@/components/Header";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { resolveLocale } from "@/lib/locale";

/** Reads live data, so it renders per request and the build needs no database. */
export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  const filters = parseListingFilters(await searchParams);
  const [listings, activeCount] = await Promise.all([searchListings(filters), countActiveListings()]);
  const filtered = Object.values(filters).some((value) => value !== undefined);
  return (
    <>
      <Header locale={locale} t={t} />
      <main>
        <section className="hero">
          <h1>{t.hero.title}</h1>
          <p>{t.hero.lead}</p>
          {/* Keyed so that header links, which navigate without a reload, reset the form. */}
          <SearchBar key={JSON.stringify(filters)} t={t} filters={filters} />
          <div className="trust">
            <span>
              <b>{activeCount}</b> {t.stats.listings}
            </span>
            <span>
              <b>70+</b> {t.stats.agents}
            </span>
            <span>{t.stats.cities}</span>
          </div>
        </section>
        <section className="section">
          <div className="row">
            <h2>{filtered ? t.search.results : t.featured}</h2>
          </div>
          {listings.length === 0 ? (
            <p className="meta">{t.search.empty}</p>
          ) : (
            <div className="cards">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} locale={locale} t={t} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
