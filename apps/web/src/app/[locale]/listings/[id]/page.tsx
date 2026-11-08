import Image from "next/image";
import { notFound } from "next/navigation";
import { getListing } from "@mteam/db";
import { formatDay, formatPrice, getDictionary } from "@mteam/shared";
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
            {listing.images.length === 0 ? (
              <>
                <div className={`ph ${listing.tone}`} />
                <div className="ph sand" />
                <div className="ph steel" />
              </>
            ) : (
              listing.images.map((url, index) => (
                <div key={url} className="ph">
                  <Image src={url} alt={`${listing.title} ${index + 1}`} fill unoptimized priority={index === 0} />
                </div>
              ))
            )}
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
            {listing.rooms > 0 && (
              <div>
                <dt>{t.listing.rooms}</dt>
                <dd>{listing.rooms}</dd>
              </div>
            )}
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
          <div className="agent">
            {listing.agent ? (
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
      </main>
    </>
  );
}
