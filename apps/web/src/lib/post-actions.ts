"use server";

import { priceStats, type PriceStat } from "@mteam/db";
import { isCity } from "@mteam/shared";
import { z } from "zod";

const statsInputSchema = z.object({ city: z.string().max(100).refine(isCity), deal: z.enum(["sale", "rent"]) });

/** Typical apartment prices per m² in a city, for the price hint on the posting form. The same public figures as the prices page. */
export async function marketStatsAction(city: string, deal: string): Promise<PriceStat[]> {
  const input = statsInputSchema.safeParse({ city, deal });
  return input.success ? priceStats(input.data.city, input.data.deal) : [];
}
