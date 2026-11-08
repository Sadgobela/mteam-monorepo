import Link from "next/link";
import { redirect } from "next/navigation";
import { countListings, getFavoriteIds, PAGE_SIZE, searchListings } from "@mteam/db";
import { getDictionary, parseListingDisplay, parseListingFilters } from "@mteam/shared";
import { FilterChips } from "@/components/FilterChips";
import { Header } from "@/components/Header";
import { ListingMap } from "@/components/ListingMap";
import { LeadForm } from "@/components/LeadForm";
import { ListingGrid } from "@/components/ListingGrid";
import { SearchBar } from "@/components/SearchBar";
import { Segmented } from "@/components/Segmented";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";
import { resultsHref, type Query } from "@/lib/url";

const HOME_LISTINGS = 4;
const MAP_LISTINGS = 200;

/** Reads live data, so it renders per request and the build needs no database. */
export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Query>;
}) {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  const query = await searchParams;
  const filters = parseListingFilters(query);
  const display = parseListingDisplay(query);

  // A submitted form always sends "deal", even when every filter is left empty.
  const isResults = typeof query.deal === "string" || Object.values(filters).some((value) => value !== undefined);
  const isMap = isResults && display.view === "map";
  const [listings, total] = await Promise.all([
    isResults
      ? searchListings(filters, isMap ? { sort: display.sort, limit: MAP_LISTINGS } : { sort: display.sort, page: display.page })
      : searchListings({ verified: true }, { limit: HOME_LISTINGS }),
    isResults ? countListings(filters) : 0,
  ]);
  const user = await currentUser();
  const favoriteIds = user ? await getFavoriteIds(user.id) : [];
  const href = (change: Record<string, string>) => resultsHref(locale, query, change);

  // An old link can point past the end once listings are removed.
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (isResults && !isMap && display.page > lastPage) redirect(href({ page: String(lastPage) }));

  return (
    <>
      <Header locale={locale} t={t} signedIn={user !== null} />
      <main className="page">
        {/* Keyed so that header links, which navigate without a reload, reset the form. */}
        <SearchBar key={JSON.stringify([filters, display])} t={t} filters={filters} display={display} />

        {isResults && <FilterChips locale={locale} t={t} query={query} filters={filters} />}

        {isResults ? (
          <div className="toolbar">
            <b>{t.results.found.replace("{count}", String(total))}</b>
            <span className="sp" />
            <Segmented
              label={t.results.sort}
              options={[
                { text: t.results.sortNew, href: href({ sort: "new", page: "1" }), active: display.sort === "new" },
                { text: t.results.sortAsc, href: href({ sort: "asc", page: "1" }), active: display.sort === "asc" },
                { text: t.results.sortDesc, href: href({ sort: "desc", page: "1" }), active: display.sort === "desc" },
              ]}
            />
            <Segmented
              label={t.results.view}
              options={[
                { text: t.results.grid, href: href({ view: "grid" }), active: display.view === "grid" },
                { text: t.results.list, href: href({ view: "list" }), active: display.view === "list" },
                { text: t.results.map, href: href({ view: "map", page: "1" }), active: display.view === "map" },
              ]}
            />
          </div>
        ) : (
          <div className="tiles">
            <Link href={`/${locale}?verified=1`} className="tile">
              <b>{t.home.verifiedTitle}</b>
              <span className="meta">{t.home.verifiedLead}</span>
            </Link>
            <a href="#give" className="tile main">
              <b>{t.home.giveTitle}</b>
              <span>{t.home.giveLead}</span>
            </a>
            <Link href={`/${locale}/listings/new`} className="tile">
              <b>{t.home.postTitle}</b>
              <span className="meta">{t.home.postLead}</span>
            </Link>
          </div>
        )}

        <div className="row">
          <h1 className="heading">{isResults ? t.search.results : t.home.heading}</h1>
          <Segmented
            label={t.results.currency}
            options={[
              { text: "₾", href: href({ cur: "gel" }), active: display.cur === "gel" },
              { text: "$", href: href({ cur: "usd" }), active: display.cur === "usd" },
            ]}
          />
        </div>

        {listings.length === 0 ? (
          <p className="meta">{t.search.empty}</p>
        ) : isMap ? (
          <ListingMap
            label={t.results.map}
            points={listings.flatMap((l) =>
              l.lat === undefined || l.lng === undefined
                ? []
                : [{ id: l.id, lat: l.lat, lng: l.lng, label: l.title, href: `/${locale}/listings/${l.id}` }],
            )}
          />
        ) : (
          <ListingGrid
            listings={listings}
            locale={locale}
            t={t}
            cur={display.cur}
            list={isResults && display.view === "list"}
            signedIn={user !== null}
            favoriteIds={favoriteIds}
          />
        )}

        {isResults && !isMap && (display.page > 1 || display.page * PAGE_SIZE < total) && (
          <nav className="pager" aria-label={t.results.pages}>
            {display.page > 1 && <Link href={href({ page: String(display.page - 1) })}>{t.results.previous}</Link>}
            {display.page * PAGE_SIZE < total && <Link href={href({ page: String(display.page + 1) })}>{t.results.next}</Link>}
          </nav>
        )}

        <section id="give" className="band">
          <h2>{t.home.bandTitle}</h2>
          <p>{t.home.bandText}</p>
          <LeadForm t={t} />
        </section>
      </main>
    </>
  );
}
