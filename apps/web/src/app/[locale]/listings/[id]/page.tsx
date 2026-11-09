import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getListing } from "@mteam/db";
import { convertPrice, formatDay, formatPrice, getDictionary, parseListingDisplay } from "@mteam/shared";
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
  const here = `/${locale}/listings/${listing.id}`;

  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <main className="listing">
        <div className="gal">
          {listing.images.length === 0 ? (
            <>
              <div className={`ph ${listing.tone}`} />
              <div className="ph sand" />
              <div className="ph steel" />
            </>
          ) : (
            listing.images.map((url, index) => (
              <a key={url} className="ph" href={url} target="_blank" rel="noreferrer">
                <Image src={url} alt={`${listing.title} ${index + 1}`} fill unoptimized priority={index === 0} />
              </a>
            ))
          )}
        </div>
        <div className="lhead">
          <h1>{listing.title}</h1>
          <span className="meta">
            {listing.address} · ID {listing.id}
          </span>
        </div>
        <aside className="side">
          <div className="agent">
            <div className="row">
              <span className="price big">
                {formatPrice(shown, currency)}
                {listing.deal === "rent" && <small className="meta"> {t.perMonth}</small>}
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
              <b>mTeam Verified</b>
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
            {listing.condition && (
              <Fact icon="condition" label={t.listing.condition}>
                {listing.condition}
              </Fact>
            )}
          </dl>
          <p>{listing.description}</p>
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
