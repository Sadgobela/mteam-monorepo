import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { refreshMarketLevels, saveGelPerUsd } from "@mteam/db";

const NBG_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?currencies=USD";

const cronEnvSchema = z.object({ CRON_SECRET: z.string().min(32) });

const nbgSchema = z
  .array(
    z.object({
      currencies: z
        .array(z.object({ code: z.literal("USD"), quantity: z.number().positive(), rate: z.number().positive(), validFromDate: z.coerce.date() }))
        .length(1),
    }),
  )
  .length(1);

/** Outside this band the feed is broken, not the lari, and keeping yesterday's rate beats repricing every listing wrongly. */
const SANE_GEL_PER_USD = { min: 1, max: 10 };

/** Vercel Cron sends the secret as a bearer token. Without a configured secret, nothing is let in. */
function authorized(request: Request): boolean {
  const env = cronEnvSchema.safeParse(process.env);
  if (!env.success) return false;
  const expected = Buffer.from(`Bearer ${env.data.CRON_SECRET}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The National Bank's official rate for the next day, as lari per dollar, or null if the feed cannot be trusted. */
async function fetchGelPerUsd(): Promise<{ gelPerUsd: number; validFrom: Date } | null> {
  try {
    const response = await fetch(NBG_URL, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const parsed = nbgSchema.safeParse(response.ok ? await response.json() : null);
    if (!parsed.success) return null;
    const { quantity, rate, validFromDate } = parsed.data[0].currencies[0];
    const gelPerUsd = rate / quantity;
    return gelPerUsd >= SANE_GEL_PER_USD.min && gelPerUsd <= SANE_GEL_PER_USD.max ? { gelPerUsd, validFrom: validFromDate } : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Runs every night (see vercel.json): stores the National Bank rate, which reprices lari listings, then recalculates
 * market levels, which read those prices. A bad rate keeps the old one and still refreshes market levels, but answers 502 so the run shows as failed.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rate = await fetchGelPerUsd();
  const repriced = rate ? await saveGelPerUsd(rate.gelPerUsd, rate.validFrom) : 0;
  const marketLevels = await refreshMarketLevels();
  console.info(`nightly: rate ${rate?.gelPerUsd ?? "kept"}, repriced ${repriced}, market levels ${marketLevels}`);
  return NextResponse.json({ gelPerUsd: rate?.gelPerUsd ?? null, repriced, marketLevels }, { status: rate ? 200 : 502 });
}
