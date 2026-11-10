import type { Listing } from "@mteam/shared";
import type { Prisma } from "@prisma/client";
import { db } from "./client";
import { publicInclude, toListing } from "./listings";

const QUEUE_LIMIT = 50;

// Imports go last, or thousands of them would keep what people post out of the queue.
const queueOrder = [{ sourceRef: { sort: "asc", nulls: "first" } }, { id: "asc" }] satisfies Prisma.ListingOrderByWithRelationInput[];

/** New listings waiting for a decision, oldest first so nobody waits longest. */
export async function listPendingListings(): Promise<Listing[]> {
  const rows = await db().listing.findMany({
    where: { status: "PENDING" },
    include: publicInclude,
    orderBy: queueOrder,
    take: QUEUE_LIMIT,
  });
  return rows.map(toListing);
}

/** Only a listing still pending can be decided, so two moderators cannot overwrite each other. */
export async function reviewListing(id: number, decision: "ACTIVE" | "REJECTED"): Promise<void> {
  await db().listing.updateMany({ where: { id, status: "PENDING" }, data: { status: decision } });
}

/** Published listings a broker has not checked yet. */
export async function listUnverifiedListings(): Promise<Listing[]> {
  const rows = await db().listing.findMany({
    where: { status: "ACTIVE", verified: false },
    include: publicInclude,
    orderBy: queueOrder,
    take: QUEUE_LIMIT,
  });
  return rows.map(toListing);
}

export async function verifyListing(agentId: string, id: number): Promise<void> {
  await db().listing.updateMany({
    where: { id, status: "ACTIVE", verified: false },
    data: { verified: true, verifiedAt: new Date(), verifiedById: agentId },
  });
}

export async function listOpenLeads() {
  return db().lead.findMany({
    where: { status: { in: ["NEW", "CONTACTED"] } },
    select: { id: true, name: true, phone: true, deal: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: QUEUE_LIMIT,
  });
}

export async function markLeadContacted(id: string): Promise<void> {
  await db().lead.updateMany({ where: { id, status: "NEW" }, data: { status: "CONTACTED" } });
}
