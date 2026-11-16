import type { Listing } from "@mteam/shared";
import type { Prisma } from "@prisma/client";
import { db } from "./client";
import { publicInclude, toListing } from "./listings";
import { expiryFrom } from "./my-listings";
import { notifyListingReviewed } from "./notifications";

const QUEUE_LIMIT = 50;

// Imports go last, or thousands of them would keep what people post out of the queue.
const queueOrder = [{ sourceRef: { sort: "asc", nulls: "first" } }, { id: "asc" }] satisfies Prisma.ListingOrderByWithRelationInput[];

/** A listing in the queue, with the exact time of its last change, which a decision must name. */
export type PendingListing = Listing & { editedAt: string };

/** New listings waiting for a decision, oldest first so nobody waits longest. */
export async function listPendingListings(): Promise<PendingListing[]> {
  const rows = await db().listing.findMany({
    where: { status: "PENDING" },
    include: publicInclude,
    orderBy: queueOrder,
    take: QUEUE_LIMIT,
  });
  return rows.map((row) => ({ ...toListing(row), editedAt: row.updatedAt.toISOString() }));
}

/**
 * Decides a listing that is still pending and unchanged since the moderator saw it (`editedAt` from the queue). Owners can edit
 * a listing while it waits, so a decision on an older version, or a second moderator's, leaves it alone. Returns whether it applied.
 */
export async function reviewListing(id: number, decision: "ACTIVE" | "REJECTED", editedAt: Date, now = new Date()): Promise<boolean> {
  const seen = { id, status: "PENDING", updatedAt: editedAt } as const;
  // An owner's listing starts its 60 days on approval. When this matches, the update below finds nothing left to do.
  const owners = decision === "ACTIVE" ? await db().listing.updateMany({ where: { ...seen, agentId: null }, data: { status: decision, expiresAt: expiryFrom(now) } }) : { count: 0 };
  const others = await db().listing.updateMany({ where: seen, data: { status: decision } });
  const applied = owners.count + others.count > 0;
  if (applied) await notifyListingReviewed(id, decision);
  return applied;
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
    select: { id: true, name: true, phone: true, deal: true, search: true, listingId: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: QUEUE_LIMIT,
  });
}

export async function markLeadContacted(id: string): Promise<void> {
  await db().lead.updateMany({ where: { id, status: "NEW" }, data: { status: "CONTACTED" } });
}
