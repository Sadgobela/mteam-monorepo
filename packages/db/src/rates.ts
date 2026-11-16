import type { PrismaClient } from "@prisma/client";
import { FALLBACK_GEL_PER_USD } from "@mteam/shared";
import { db } from "./client";

/** Lari per dollar: the stored National Bank rate, or the fallback until the first nightly run has stored one. */
export async function getGelPerUsd(client: PrismaClient = db()): Promise<number> {
  const row = await client.exchangeRate.findUnique({ where: { currency: "USD" }, select: { gelPerUnit: true } });
  return row?.gelPerUnit ?? FALLBACK_GEL_PER_USD;
}

/**
 * Stores a new dollar rate and re-derives the dollar prices of listings priced in lari, in one transaction,
 * so search and sorting never mix two rates. Rounds as draftColumns does: price per m² from the rounded dollar price.
 * Returns how many listings were repriced.
 */
export async function saveGelPerUsd(gelPerUsd: number, validFrom: Date): Promise<number> {
  const [, repriced] = await db().$transaction([
    db().exchangeRate.upsert({
      where: { currency: "USD" },
      create: { currency: "USD", gelPerUnit: gelPerUsd, validFrom },
      update: { gelPerUnit: gelPerUsd, validFrom },
    }),
    db().$executeRaw`
      UPDATE "Listing" SET
        "priceUsd" = ROUND(price::numeric / ${gelPerUsd}::numeric),
        "pricePerSqmUsd" = ROUND(ROUND(price::numeric / ${gelPerUsd}::numeric) / area::numeric)
      WHERE currency = 'GEL' AND area > 0`,
  ]);
  return repriced;
}
