import type { LeadDraft } from "@mteam/shared";
import { db } from "./client";

const REPEAT_WINDOW_MS = 24 * 60 * 60_000;
const dbDeals = { sale: "SALE", rent: "RENT" } as const;

/** Saves a "Give it to MTeam" request. A repeat from the same phone within a day is ignored, so brokers get one lead. */
export async function createLead(lead: LeadDraft): Promise<void> {
  const client = db();
  const since = new Date(Date.now() - REPEAT_WINDOW_MS);
  const recent = await client.lead.findFirst({
    where: { phone: lead.phone, createdAt: { gte: since } },
    select: { id: true },
  });
  if (recent) return;
  await client.lead.create({ data: { name: lead.name, phone: lead.phone, deal: dbDeals[lead.deal] } });
}
