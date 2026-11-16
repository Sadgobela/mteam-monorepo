// Track C (my listings), see docs/ACCOUNT_PLAN.md.
import type { Listing, SortOrder } from "@mteam/shared";
import type { ListingStatus, Prisma } from "@prisma/client";
import { db } from "./client";
import { publicInclude, toListing } from "./listings";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Owners' listings end this long after approval or the last renewal. Brokers' listings never end. */
const LIFETIME_DAYS = 60;
/** Inside this window an owner's listing shows under "expiring soon". */
const EXPIRING_DAYS = 7;
/** One free bump per listing in this time. */
const BUMP_EVERY_MS = DAY_MS;
const LIST_LIMIT = 100;

export const myListingTabs = ["active", "pending", "draft", "expiring", "archived", "rejected"] as const;
export type MyListingTab = (typeof myListingTabs)[number];

/** A listing as its owner sees it: the public card plus its numbers and what can be done with it now. */
export type MyListing = {
  listing: Listing;
  status: ListingStatus;
  views: number;
  phoneReveals: number;
  favorites: number;
  conversations: number;
  /** Set for owners' published listings: when it ends unless renewed. */
  expiresAt?: Date;
  canRenew: boolean;
  canBump: boolean;
  /** When a listing bumped in the last 24 hours can be bumped again. */
  nextBumpAt?: Date;
};

/** When a listing approved or renewed now ends. */
export function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + LIFETIME_DAYS * DAY_MS);
}

/** Only owners' listings expire; a broker's listing is one with an agent. */
const ownerListing = { agentId: null } satisfies Prisma.ListingWhereInput;

function tabWhere(tab: MyListingTab, now: Date): Prisma.ListingWhereInput {
  const where: Record<MyListingTab, Prisma.ListingWhereInput> = {
    active: { status: "ACTIVE" },
    pending: { status: "PENDING" },
    draft: { status: "DRAFT" },
    expiring: { status: "ACTIVE", ...ownerListing, expiresAt: { gt: now, lte: new Date(now.getTime() + EXPIRING_DAYS * DAY_MS) } },
    archived: { status: "ARCHIVED" },
    rejected: { status: "REJECTED" },
  };
  return where[tab];
}

/** Renewable: an owner's published listing, or one the nightly job archived because its time ran out. */
const renewableWhere = (now: Date) =>
  ({ ...ownerListing, OR: [{ status: "ACTIVE" }, { status: "ARCHIVED", expiresAt: { lt: now } }] }) satisfies Prisma.ListingWhereInput;

const bumpableWhere = (now: Date) =>
  ({ status: "ACTIVE", OR: [{ bumpedAt: null }, { bumpedAt: { lte: new Date(now.getTime() - BUMP_EVERY_MS) } }] }) satisfies Prisma.ListingWhereInput;

/** How many of a user's listings each tab holds. Also meant for the account sidebar. */
export async function countMyListings(ownerId: string, now = new Date()): Promise<Record<MyListingTab, number>> {
  const [groups, expiring] = await Promise.all([
    db().listing.groupBy({ by: ["status"], where: { ownerId }, _count: { _all: true } }),
    db().listing.count({ where: { ownerId, ...tabWhere("expiring", now) } }),
  ]);
  const byStatus = (status: ListingStatus) => groups.find((group) => group.status === status)?._count._all ?? 0;
  return {
    active: byStatus("ACTIVE"),
    pending: byStatus("PENDING"),
    draft: byStatus("DRAFT"),
    expiring,
    archived: byStatus("ARCHIVED"),
    rejected: byStatus("REJECTED"),
  };
}

/** Digits look up a listing number; anything else is matched as words in the title or address. */
function searchWhere(q: string): Prisma.ListingWhereInput[] | undefined {
  if (q === "") return undefined;
  // Without escaping, % and _ would act as LIKE wildcards.
  const match = { contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } as const;
  const byId = /^\d{1,9}$/.test(q) ? [{ id: Number(q) }] : [];
  return [{ title: match }, { description: match }, { address: match }, { district: match }, { street: match }, ...byId];
}

const myOrder: Record<SortOrder, Prisma.ListingOrderByWithRelationInput[]> = {
  new: [{ id: "desc" }],
  asc: [{ priceUsd: "asc" }, { id: "desc" }],
  desc: [{ priceUsd: "desc" }, { id: "desc" }],
};

/** One tab of the user's own listings, with the statistics the owner sees. Nobody else's listing can appear here. */
export async function listMyListingsTab(
  ownerId: string,
  { tab, q = "", sort = "new" }: { tab: MyListingTab; q?: string; sort?: SortOrder },
  now = new Date(),
): Promise<MyListing[]> {
  const rows = await db().listing.findMany({
    where: { ...tabWhere(tab, now), ownerId, OR: searchWhere(q) },
    include: { ...publicInclude, _count: { select: { favorites: true, conversations: true } } },
    orderBy: myOrder[sort],
    // ponytail: one page of 100, add paging when an owner has more in one tab.
    take: LIST_LIMIT,
  });
  return rows.map((row) => {
    const owners = row.agentId === null;
    const published = row.status === "ACTIVE";
    const bumpAgainAt = row.bumpedAt ? new Date(row.bumpedAt.getTime() + BUMP_EVERY_MS) : undefined;
    const waiting = published && bumpAgainAt !== undefined && bumpAgainAt > now;
    return {
      listing: toListing(row),
      status: row.status,
      views: row.views,
      phoneReveals: row.phoneReveals,
      favorites: row._count.favorites,
      conversations: row._count.conversations,
      expiresAt: owners && published ? (row.expiresAt ?? undefined) : undefined,
      canRenew: owners && (published || (row.status === "ARCHIVED" && row.expiresAt !== null && row.expiresAt < now)),
      canBump: published && !waiting,
      nextBumpAt: waiting ? bumpAgainAt : undefined,
    };
  });
}

/** Gives an owner's listing another 60 days, and brings it back if it ended by expiry. False when the listing is not the user's or cannot be renewed. */
export async function renewListing(ownerId: string, id: number, now = new Date()): Promise<boolean> {
  const { count } = await db().listing.updateMany({
    where: { id, ownerId, ...renewableWhere(now) },
    data: { status: "ACTIVE", expiresAt: expiryFrom(now) },
  });
  return count > 0;
}

/** The free daily bump: moves a published listing up in "newest". False when it is not the user's, not published, or was bumped in the last 24 hours. */
export async function bumpListing(ownerId: string, id: number, now = new Date()): Promise<boolean> {
  const { count } = await db().listing.updateMany({ where: { id, ownerId, ...bumpableWhere(now) }, data: { bumpedAt: now } });
  return count > 0;
}

/** Nightly: archives owners' listings whose 60 days have passed. Returns how many. */
export async function archiveExpiredListings(now = new Date()): Promise<number> {
  const { count } = await db().listing.updateMany({
    where: { status: "ACTIVE", ...ownerListing, expiresAt: { lt: now } },
    data: { status: "ARCHIVED" },
  });
  return count;
}

/** Counts one look at a published listing's number. False when the owner hid it, so the caller answers as if there were none. */
export async function countPhoneReveal(id: number): Promise<boolean> {
  const { count } = await db().listing.updateMany({
    where: { id, status: "ACTIVE", hidePhone: false },
    data: { phoneReveals: { increment: 1 } },
  });
  return count > 0;
}
