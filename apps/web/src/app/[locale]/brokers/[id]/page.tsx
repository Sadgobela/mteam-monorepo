import Image from "next/image";
import { notFound } from "next/navigation";
import { getGelPerUsd, getBroker, getBrokerProfile, getFavoriteIds } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { ListingGrid } from "@/components/ListingGrid";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";
import "@/app/brokers.css";

export const dynamic = "force-dynamic";

export default async function BrokerPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = resolveLocale(raw);
  const broker = await getBroker(id);
  if (!broker) notFound();
  const t = getDictionary(locale);
  const user = await currentUser();
  const favoriteIds = user ? await getFavoriteIds(user.id) : [];
  const gelPerUsd = await getGelPerUsd();
  const profile = await getBrokerProfile(broker.id);
  return (
    <>
      <Header locale={locale} t={t} signedIn={user !== null} />
      <main className="page">
        <div className="agent profile">
          <div className="who">
            <span className="av broker-photo" aria-hidden="true">
              {profile?.photoUrl ? <Image src={profile.photoUrl} alt="" fill unoptimized /> : broker.name.slice(0, 1)}
            </span>
            <div>
              <h1 className="heading">{broker.name}</h1>
              <div className="meta">
                {[t.listing.broker, broker.branch].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="queue-actions">
            <a className="btn" href={`tel:${broker.phone}`}>{t.listing.call}</a>
            <a className="btn wa" href={`https://wa.me/${broker.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
              {t.listing.whatsapp}
            </a>
          </div>
        </div>
        {profile?.bio && <p className="broker-bio">{profile.bio}</p>}
        {broker.listings.length === 0 ? (
          <EmptyState text={t.search.empty} />
        ) : (
          <ListingGrid listings={broker.listings} locale={locale} t={t} cur="usd" gelPerUsd={gelPerUsd} signedIn={user !== null} favoriteIds={favoriteIds} />
        )}
      </main>
    </>
  );
}
