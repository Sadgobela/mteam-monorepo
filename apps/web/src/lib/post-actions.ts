"use server";

import { claimDescriptionWrite, priceStats, type PriceStat } from "@mteam/db";
import { isCity, parseDraftProgress } from "@mteam/shared";
import { z } from "zod";
import { writeDescriptions, type Descriptions } from "./description-ai";
import { clientIp, currentUser } from "./session";

const statsInputSchema = z.object({ city: z.string().max(100).refine(isCity), deal: z.enum(["sale", "rent"]) });

/** Typical apartment prices per m² in a city, for the price hint on the posting form. The same public figures as the prices page. */
export async function marketStatsAction(city: string, deal: string): Promise<PriceStat[]> {
  const input = statsInputSchema.safeParse({ city, deal });
  return input.success ? priceStats(input.data.city, input.data.deal) : [];
}

export type WriteResult = { descriptions: Descriptions } | { error: "unclear" | "busy" | "failed" };

const fieldsSchema = z.record(z.string().max(40), z.string());

/**
 * Writes a listing's description in three languages from the posting form's values. Only for a signed-in user with a phone, only
 * with an AI key set (the form hides the button otherwise), and limited per account and per address as each one costs an AI request.
 */
export async function writeDescriptionAction(fields: unknown): Promise<WriteResult> {
  const user = await currentUser();
  // Only someone who could post the listing, which needs a phone.
  if (!process.env.ANTHROPIC_API_KEY || !user?.phone) return { error: "failed" };
  const input = fieldsSchema.safeParse(fields);
  const draft = input.success ? parseDraftProgress(input.data) : null;
  if (!draft) return { error: "unclear" };
  if (!(await claimDescriptionWrite(await clientIp(), user.id))) return { error: "busy" };
  try {
    const descriptions = await writeDescriptions(draft);
    return descriptions ? { descriptions } : { error: "failed" };
  } catch (error) {
    console.error(error);
    return { error: "failed" };
  }
}
