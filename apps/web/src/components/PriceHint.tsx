"use client";

import { useEffect, useState } from "react";
import type { PriceStat } from "@mteam/db";
import { formatPrice, priceInUsd, type Dict } from "@mteam/shared";
import { marketStatsAction } from "@/lib/post-actions";

/** The market data covers apartments for sale and for rent, by district and room count, with 4 meaning 4 or more. */
const TOP_ROOMS = 4;

/**
 * Where the entered price per m² sits against similar apartments in the district, from the stored market data. The same bands
 * as the market levels: within 5% is typical. Shows nothing where there is no figure to compare with.
 */
export function PriceHint({ values, gelPerUsd, t }: { values: Record<string, string>; gelPerUsd: number; t: Dict }) {
  const { deal, city, type } = values;
  const covered = type === "apartment" && (deal === "sale" || deal === "rent");
  const [stats, setStats] = useState<{ key: string; rows: PriceStat[] }>({ key: "", rows: [] });
  const key = `${deal}/${city}`;

  useEffect(() => {
    if (!covered || !city) return;
    let current = true;
    void marketStatsAction(city, deal).then((rows) => current && setStats({ key, rows }));
    return () => {
      current = false;
    };
  }, [covered, city, deal, key]);

  const price = Number(values.price);
  const area = Number(values.area);
  const rooms = Math.min(Number(values.rooms), TOP_ROOMS);
  const typical = stats.key === key && stats.rows.find((stat) => stat.district === (values.district || city) && stat.rooms === rooms);
  if (!covered || !typical || !(price > 0) || !(area > 0)) return null;

  const currency = values.currency === "GEL" ? "GEL" : "USD";
  const ratio = priceInUsd(price, currency, gelPerUsd) / area / typical.median;
  const position = ratio < 0.95 ? "below" : ratio > 1.05 ? "above" : "at";
  const median = currency === "GEL" ? Math.round(typical.median * gelPerUsd) : typical.median;
  return (
    <p className="market-hint note" role="status">
      <b>{t.post.market[position]}</b> {t.post.market.typical.replace("{price}", formatPrice(median, currency))}
    </p>
  );
}
