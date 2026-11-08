import Link from "next/link";
import { listBrokers } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { Header } from "@/components/Header";
import { resolveLocale } from "@/lib/locale";
import { hasSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BrokersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = getDictionary(locale);
  const brokers = await listBrokers();
  return (
    <>
      <Header locale={locale} t={t} signedIn={await hasSession()} />
      <main className="page">
        <h1 className="heading">{t.brokers.heading}</h1>
        {brokers.length === 0 && <p className="meta">{t.brokers.empty}</p>}
        <div className="tiles">
          {brokers.map((broker) => (
            <Link key={broker.id} href={`/${locale}/brokers/${broker.id}`} className="tile broker">
              <span className="av" aria-hidden="true">{broker.name.slice(0, 1)}</span>
              <span>
                <b>{broker.name}</b>
                <span className="meta" style={{ display: "block" }}>
                  {[broker.branch, t.brokers.listings.replace("{count}", String(broker.listingCount))].filter(Boolean).join(" · ")}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
