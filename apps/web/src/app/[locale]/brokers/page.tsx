import type { Metadata } from "next";
import Link from "next/link";
import { listBranches, listBrokers } from "@mteam/db";
import { getDictionary, placeLabel } from "@mteam/shared";
import { BrokerTiles } from "@/components/BrokerTiles";
import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { resolveLocale } from "@/lib/locale";
import { languageAlternates } from "@/lib/seo";
import { hasSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  return { title: t.brokers.heading, alternates: languageAlternates("/brokers", locale) };
}

export default async function BrokersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  const [brokers, branches] = await Promise.all([listBrokers(), listBranches()]);
  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <main className="page">
        <h1 className="heading">{t.brokers.heading}</h1>
        {brokers.length === 0 && <EmptyState text={t.brokers.empty} />}
        {branches.length > 0 && (
          <>
            <h2 className="subheading">{t.brokers.branches}</h2>
            <div className="tiles people">
              {branches.map((branch) => (
                <Link key={branch.id} href={`/${locale}/branches/${branch.id}`} className="tile">
                  <b>{branch.name}</b>
                  <span className="meta">
                    {[placeLabel(branch.city, locale), t.brokers.people.replace("{count}", String(branch.brokerCount)), t.brokers.listings.replace("{count}", String(branch.listingCount))].join(" · ")}
                  </span>
                </Link>
              ))}
            </div>
            <h2 className="subheading">{t.brokers.team}</h2>
          </>
        )}
        <BrokerTiles brokers={brokers} locale={locale} t={t} />
      </main>
    </>
  );
}
