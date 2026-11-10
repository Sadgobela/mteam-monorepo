import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getListing } from "@mteam/db";
import { placeLabel, priceUnit, convertPrice, formatDay, formatPrice, getDictionary, parseListingDisplay } from "@mteam/shared";
import { Gallery } from "@/components/Gallery";
import { ListingDetails } from "@/components/ListingDetails";
import { Header } from "@/components/Header";
import { GiveBand } from "@/components/LeadForm";
import { ListingMap } from "@/components/ListingMap";
import { Segmented } from "@/components/Segmented";
import { resolveLocale } from "@/lib/locale";
import { hasSession } from "@/lib/session";
import type { Query } from "@/lib/url";

export const dynamic = "force-dynamic";

const factIcons = {
  area: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  rooms: "M6 21V4h12v17M3 21h18M14 12h.01",
  floor: "M3 20h5v-5h5v-5h5V5h3",
  metro: "M4 20V5l8 9 8-9v15",
  condition: "M4 4h13v5H4zM17 6.5h3V12h-8v3M10 15h4v6h-4z",
};

function Fact({ icon, label, children }: { icon: keyof typeof factIcons; label: string; children: ReactNode }) {
  return (
    <div>
      <dt>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={factIcons[icon]} />
        </svg>
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Query>;
}) {
  const { locale: raw, id } = await params;
  const locale = resolveLocale(raw);
  const listing = await getListing(id);
  if (!listing) notFound();
  const t = getDictionary(locale);
  const { cur } = parseListingDisplay(await searchParams);
  const shown = convertPrice(listing.price, listing.currency, cur);
  const currency = cur === "gel" ? "GEL" : "USD";
  const unit = priceUnit(listing.deal, t);
  const here = `/${locale}/listings/${listing.id}`;

  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <main className="listing">
        <Gallery images={listing.images} title={listing.title} tone={listing.tone} t={t} />
        <div className="lhead">
          <nav className="crumbs" aria-label={t.listing.path}>
            <Link href={`/${locale}?deal=${listing.deal}`}>{t.deal[listing.deal]}</Link>
            <Link href={`/${locale}?deal=${listing.deal}&city=${encodeURIComponent(listing.city)}`}>{placeLabel(listing.city, locale)}</Link>
            {listing.district && <span>{placeLabel(listing.district, locale)}</span>}
          </nav>
          <h1>{listing.title}</h1>
          <span className="meta">
            {listing.address} · ID {listing.id} · {formatDay(listing.updatedAt, locale)}
          </span>
        </div>
        <aside className="side">
          <div className="agent">
            <div className="row">
              <span className="price big">
                {formatPrice(shown, currency)}
                {unit && <small className="meta"> {unit}</small>}
              </span>
              <Segmented
                label={t.results.currency}
                options={[
                  { text: "₾", href: `${here}?cur=gel`, active: cur === "gel" },
                  { text: "$", href: here, active: cur === "usd" },
                ]}
              />
            </div>
            {listing.deal === "sale" && (
              <span className="meta">
                {formatPrice(Math.round(shown / listing.area), currency)} / {t.units.sqm}
              </span>
            )}
            {/* Conversions use fixed rates, so the price the listing was actually posted at stays visible. */}
            {listing.currency !== currency && (
              <span className="meta">
                {t.listing.listedPrice}: {formatPrice(listing.price, listing.currency)}
              </span>
            )}
            {listing.agent ? (
              <div className="who">
                <span className="av" aria-hidden="true">
                  {listing.agent.name.slice(0, 1)}
                </span>
                <div>
                  <Link href={`/${locale}/brokers/${listing.agent.id}`}><b>{listing.agent.name}</b></Link>
                  <div className="meta">
                    {t.listing.broker} · {listing.agent.branch}
                  </div>
                </div>
              </div>
            ) : (
              <b>{t.listing.owner}</b>
            )}
            <div className="btns">
              <a className="btn" href={`tel:${listing.contactPhone}`}>{t.listing.call}</a>
              <a className="btn wa" href={`https://wa.me/${listing.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                {t.listing.whatsapp}
              </a>
            </div>
          </div>
          {listing.verified && (
            <div className="note">
              <b>MTeam Verified</b>
              <br />
              {t.listing.verifiedNote}
              {listing.verification && (
                <div className="meta">
                  {t.listing.checkedBy.replace("{name}", listing.verification.by).replace("{date}", formatDay(listing.verification.at, locale))}
                </div>
              )}
            </div>
          )}
        </aside>
        <div className="ldesc">
          <dl className="facts">
            <Fact icon="area" label={t.listing.area}>
              {listing.area} {t.units.sqm}
            </Fact>
            {listing.rooms > 0 && (
              <Fact icon="rooms" label={t.listing.rooms}>
                {listing.rooms}
              </Fact>
            )}
            {listing.floor && (
              <Fact icon="floor" label={t.listing.floor}>
                {listing.floor} / {listing.floors}
              </Fact>
            )}
            {listing.building && (
              <Fact icon="condition" label={t.search.status}>
                {t.search.building[listing.building]}
              </Fact>
            )}
            {listing.metro && (
              <Fact icon="metro" label={t.search.metro}>
                {placeLabel(listing.metro, locale)}
              </Fact>
            )}
          </dl>
          <p>{listing.description}</p>
          <ListingDetails listing={listing} locale={locale} t={t} />
          {listing.lat !== undefined && listing.lng !== undefined && (
            <ListingMap
              label={t.results.map}
              points={[{ id: listing.id, lat: listing.lat, lng: listing.lng, label: listing.title, href: `/${locale}/listings/${listing.id}` }]}
            />
          )}
          <GiveBand t={t} />
        </div>
      </main>
    </>
  );
}
