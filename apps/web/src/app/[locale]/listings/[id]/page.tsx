import { notFound } from "next/navigation";
import { getListing } from "@mteam/db";
import { formatPrice, getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { resolveLocale } from "@/lib/locale";
import { hasSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = resolveLocale(raw);
  const listing = await getListing(id);
  if (!listing) notFound();
  const t = getDictionary(locale);
  const perSqm = Math.round(listing.price / listing.area);

  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <main className="listing">
        <div className="ldesc">
          <div className="gal">
            <div className={`ph ${listing.tone}`} />
            <div className="ph sand" />
            <div className="ph steel" />
          </div>
          <div className="row">
            <h1>{listing.title}</h1>
            <span className="price big">{formatPrice(listing.price, listing.currency)}</span>
          </div>
          <span className="meta">
            {listing.address} · ID {listing.id} · {formatPrice(perSqm, listing.currency)} / {t.units.sqm}
          </span>
          <dl className="facts">
            <div>
              <dt>{t.listing.area}</dt>
              <dd>
                {listing.area} {t.units.sqm}
              </dd>
            </div>
            <div>
              <dt>{t.listing.rooms}</dt>
              <dd>{listing.rooms}</dd>
            </div>
            {listing.floor && (
              <div>
                <dt>{t.listing.floor}</dt>
                <dd>
                  {listing.floor} / {listing.floors}
                </dd>
              </div>
            )}
            {listing.condition && (
              <div>
                <dt>{t.listing.condition}</dt>
                <dd>{listing.condition}</dd>
              </div>
            )}
          </dl>
          <p>{listing.description}</p>
        </div>
        <aside className="side">
          {listing.agent && (
            <div className="agent">
              <div className="who">
                <span className="av" aria-hidden="true">
                  {listing.agent.name.slice(0, 1)}
                </span>
                <div>
                  <b>{listing.agent.name}</b>
                  <div className="meta">
                    {t.listing.broker} · {listing.agent.branch}
                  </div>
                </div>
              </div>
              <div className="btns">
                <button type="button" className="btn">{t.listing.call}</button>
                <button type="button" className="btn wa">{t.listing.whatsapp}</button>
                <button type="button" className="btn ghost">{t.listing.book}</button>
              </div>
            </div>
          )}
          {listing.verified && (
            <div className="note">
              <b>mTeam Verified</b>
              <br />
              {t.listing.verifiedNote}
            </div>
          )}
        </aside>
      </main>
    </>
  );
}
