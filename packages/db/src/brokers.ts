import type { Listing } from "@mteam/shared";
import { db } from "./client";
import { publicInclude, toListing } from "./listings";

const BROKER_LIMIT = 200;
const PROFILE_LISTINGS = 48;

export interface Broker {
  id: string;
  name: string;
  branch: string;
  phone: string;
}

/** Only people with the broker role and a name set. Their phone is public, so admins and former brokers must not appear. */
export async function listBrokers(): Promise<(Broker & { listingCount: number })[]> {
  const rows = await db().agent.findMany({
    where: { user: { name: { not: null }, role: "AGENT" } },
    include: {
      user: { select: { name: true, phone: true } },
      branch: { select: { name: true } },
      _count: { select: { listings: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { user: { name: "asc" } },
    take: BROKER_LIMIT,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.user.name ?? "",
    branch: row.branch?.name ?? "",
    phone: row.user.phone,
    listingCount: row._count.listings,
  }));
}

export async function getBroker(id: string): Promise<(Broker & { listings: Listing[] }) | null> {
  if (!/^[\w-]{1,40}$/.test(id)) return null;
  const row = await db().agent.findFirst({
    where: { id, user: { name: { not: null }, role: "AGENT" } },
    include: {
      user: { select: { name: true, phone: true } },
      branch: { select: { name: true } },
      listings: { where: { status: "ACTIVE" }, include: publicInclude, orderBy: { id: "desc" }, take: PROFILE_LISTINGS },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.user.name ?? "",
    branch: row.branch?.name ?? "",
    phone: row.user.phone,
    listings: row.listings.map(toListing),
  };
}
