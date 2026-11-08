import { countActiveListings, searchListings } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { resolveLocale } from "@/lib/locale";

/** Reads live data, so it renders per request and the build needs no database. */
export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  const [listings, activeCount] = await Promise.all([searchListings(), countActiveListings()]);
  return (
    <>
      <Header locale={locale} t={t} />
      <main>
        <section className="hero">
          <h1>{t.hero.title}</h1>
          <p>{t.hero.lead}</p>
          <SearchBar t={t} />
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
            <h2>{t.featured}</h2>
          </div>
          <div className="cards">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} locale={locale} t={t} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
