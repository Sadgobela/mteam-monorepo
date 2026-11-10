import type { DealType } from "@mteam/shared";
import { z } from "zod";
import { db } from "./client";

/** Fewer than this says nothing about a market, so no level or statistic is shown. */
const MIN_COMPARABLES = 5;

/**
 * Places every published listing against the typical price per m² of the same deal, type and district.
 * ponytail: stored and recalculated by `db:market`, so it lags new listings. Run it nightly once the site is live.
 */
export function refreshMarketLevels(): Promise<number> {
  return db().$executeRaw`
    WITH medians AS (
      SELECT deal, type, city, COALESCE(district, '') AS district, percentile_cont(0.5) WITHIN GROUP (ORDER BY "priceUsd" / area) AS median
      FROM "Listing"
      WHERE status = 'ACTIVE' AND "priceUsd" > 0 AND area > 0
      GROUP BY 1, 2, 3, 4
      HAVING count(*) >= ${MIN_COMPARABLES}
    ), levels AS (
      -- From the exact price per m²: the stored one is rounded to whole dollars, which is too coarse for rentals and daily stays.
      SELECT l.id,
        CASE
          WHEN m.median IS NULL OR l."priceUsd" <= 0 OR l.area <= 0 THEN NULL
          WHEN l."priceUsd" / l.area / m.median < 0.85 THEN 1
          WHEN l."priceUsd" / l.area / m.median < 0.95 THEN 2
          WHEN l."priceUsd" / l.area / m.median <= 1.05 THEN 3
          WHEN l."priceUsd" / l.area / m.median <= 1.15 THEN 4
          ELSE 5
        END AS level
      FROM "Listing" l
      LEFT JOIN medians m ON m.deal = l.deal AND m.type = l.type AND m.city = l.city AND m.district = COALESCE(l.district, '')
      WHERE l.status = 'ACTIVE'
    )
    UPDATE "Listing" SET "marketLevel" = levels.level
    FROM levels
    WHERE "Listing".id = levels.id AND "Listing"."marketLevel" IS DISTINCT FROM levels.level`;
}

const statsSchema = z.array(z.object({ district: z.string(), rooms: z.coerce.number(), median: z.coerce.number().transform(Math.round) }));

export type PriceStat = z.infer<typeof statsSchema>[number];

/** Typical apartment price per m² by district and room count. The top room count means "this many or more". */
export async function priceStats(city: string, deal: Extract<DealType, "sale" | "rent">): Promise<PriceStat[]> {
  return statsSchema.parse(
    await db().$queryRaw`
      SELECT COALESCE(district, city) AS district, LEAST(rooms, 4) AS rooms, percentile_cont(0.5) WITHIN GROUP (ORDER BY "priceUsd" / area) AS median
      FROM "Listing"
      WHERE status = 'ACTIVE' AND type = 'APARTMENT' AND deal = CAST(${deal.toUpperCase()} AS "DealType") AND city = ${city} AND rooms > 0 AND "priceUsd" > 0 AND area > 0
      GROUP BY 1, 2
      HAVING count(*) >= ${MIN_COMPARABLES}
      ORDER BY 1, 2`,
  );
}
