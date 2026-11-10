import Link from "next/link";
import type { BrokerCard } from "@mteam/db";
import type { Dict, Locale } from "@mteam/shared";

export function BrokerTiles({ brokers, locale, t }: { brokers: BrokerCard[]; locale: Locale; t: Dict }) {
  return (
    <div className="tiles people">
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
  );
}
