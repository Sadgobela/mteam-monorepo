import type { Prisma } from "@prisma/client";
import type { Listing } from "@mteam/shared";
import { db } from "./client";
import { publicInclude, toListing } from "./listings";

const BROKER_LIMIT = 200;
const PROFILE_LISTINGS = 48;
const ID_FORMAT = /^[\w-]{1,40}$/;

export interface Broker {
  id: string;
  name: string;
  branch: string;
  phone: string;
}

export type BrokerCard = Broker & { listingCount: number };

export interface BranchCard {
  id: string;
  name: string;
  city: string;
  brokerCount: number;
  listingCount: number;
}

/** Only people with the broker role and a name set. Their phone is public, so admins and former brokers must not appear. */
const publicBroker = { user: { name: { not: null }, phone: { not: null }, role: "AGENT" } } satisfies Prisma.AgentWhereInput;

const liveListingCount = { listings: { where: { status: "ACTIVE" } } } satisfies Prisma.AgentCountOutputTypeSelect;

const cardInclude = {
  user: { select: { name: true, phone: true } },
  branch: { select: { name: true } },
  _count: { select: liveListingCount },
} satisfies Prisma.AgentInclude;

function toCard(row: Prisma.AgentGetPayload<{ include: typeof cardInclude }>): BrokerCard {
  return { id: row.id, name: row.user.name ?? "", branch: row.branch?.name ?? "", phone: row.user.phone ?? "", listingCount: row._count.listings };
}

export async function listBrokers(): Promise<BrokerCard[]> {
  const rows = await db().agent.findMany({ where: publicBroker, include: cardInclude, orderBy: { user: { name: "asc" } }, take: BROKER_LIMIT });
  return rows.map(toCard);
}

/** Branches with someone to show. */
export async function listBranches(): Promise<BranchCard[]> {
  const rows = await db().branch.findMany({
    where: { agents: { some: publicBroker } },
    select: { id: true, name: true, city: true, agents: { where: publicBroker, select: { _count: { select: liveListingCount } } } },
    orderBy: { name: "asc" },
  });
  return rows.map(({ agents, ...branch }) => ({ ...branch, brokerCount: agents.length, listingCount: agents.reduce((total, agent) => total + agent._count.listings, 0) }));
}

/** A branch's people and what they have on the site. Malformed and empty branches return null. */
export async function getBranch(id: string): Promise<(Omit<BranchCard, "brokerCount" | "listingCount"> & { brokers: BrokerCard[]; listings: Listing[] }) | null> {
  if (!ID_FORMAT.test(id)) return null;
  const row = await db().branch.findFirst({
    where: { id, agents: { some: publicBroker } },
    select: { id: true, name: true, city: true, agents: { where: publicBroker, include: cardInclude, orderBy: { user: { name: "asc" } } } },
  });
  if (!row) return null;
  const listings = await db().listing.findMany({
    where: { status: "ACTIVE", agent: { branchId: id, ...publicBroker } },
    include: publicInclude,
    orderBy: [{ verified: "desc" }, { id: "desc" }],
    take: PROFILE_LISTINGS,
  });
  return { id: row.id, name: row.name, city: row.city, brokers: row.agents.map(toCard), listings: listings.map(toListing) };
}

export async function getBroker(id: string): Promise<(Broker & { listings: Listing[] }) | null> {
  if (!ID_FORMAT.test(id)) return null;
  const row = await db().agent.findFirst({
    where: { id, ...publicBroker },
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
    phone: row.user.phone ?? "",
    listings: row.listings.map(toListing),
  };
}
