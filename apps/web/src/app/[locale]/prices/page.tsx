import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { priceStats } from "@mteam/db";
import { getDictionary, METRO_CITY, parseListingFilters, placeLabel, popularCities } from "@mteam/shared";
import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { resolveLocale } from "@/lib/locale";
import { languageAlternates, searchPath } from "@/lib/seo";
import { hasSession } from "@/lib/session";
import type { Query } from "@/lib/url";

export const dynamic = "force-dynamic";

const ROOMS = [1, 2, 3, 4];
const DEALS = ["sale", "rent"] as const;

// The metadata and the page need the same figures, so they are read once per request.
const loadStats = cache(priceStats);

/** Which figures a query asks for. Anything else means Tbilisi sales. */
function chosen(query: Query) {
  const filters = parseListingFilters(query);
  return { city: filters.city ?? METRO_CITY, deal: filters.deal === "rent" ? ("rent" as const) : ("sale" as const) };
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Query> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  const { city, deal } = chosen(await searchParams);
  const path = `/prices${searchPath({ deal: deal === "sale" ? undefined : deal, city: city === METRO_CITY ? undefined : city })}`;
  const robots = (await loadStats(city, deal)).length > 0 ? undefined : { index: false, follow: true };
  return { title: `${t.market.statsHeading} · ${placeLabel(city, locale)} · ${t.deal[deal]}`, alternates: languageAlternates(path, locale), robots };
}

export default async function PricesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Query> }) {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  const { city, deal } = chosen(await searchParams);
  const stats = await loadStats(city, deal);
  const districts = [...new Set(stats.map((stat) => stat.district))];
  const href = (nextCity: string, nextDeal: string) => `/${locale}/prices?city=${encodeURIComponent(nextCity)}&deal=${nextDeal}`;
  const cell = (district: string, rooms: number) => stats.find((stat) => stat.district === district && stat.rooms === rooms)?.median;
  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <main className="page">
        <div>
          <h1 className="heading">{t.market.statsHeading}</h1>
          <div className="meta">{t.market.statsHint}</div>
        </div>
        <div className="chips">
          {DEALS.map((option) => (
            <Link key={option} href={href(city, option)} aria-current={option === deal ? "true" : undefined}>
              {t.deal[option]}
            </Link>
          ))}
        </div>
        <div className="chips">
          {popularCities.map((option) => (
            <Link key={option} href={href(option, deal)} aria-current={option === city ? "true" : undefined}>
              {placeLabel(option, locale)}
            </Link>
          ))}
        </div>
        {districts.length === 0 ? (
          <EmptyState text={t.market.statsEmpty} />
        ) : (
          <div className="stats-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th scope="col">{t.market.district}</th>
                  {ROOMS.map((rooms) => (
                    <th key={rooms} scope="col">
                      {(rooms === ROOMS[ROOMS.length - 1] ? t.market.roomsPlus : t.market.rooms).replace("{count}", String(rooms))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {districts.map((district) => (
                  <tr key={district}>
                    <th scope="row">{placeLabel(district, locale)}</th>
                    {ROOMS.map((rooms) => {
                      const median = cell(district, rooms);
                      return <td key={rooms}>{median === undefined ? "–" : `$${median.toLocaleString("en-US")}`}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
