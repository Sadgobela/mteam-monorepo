import { createHash, randomBytes } from "node:crypto";
import { addressHash } from "./auth";
import { db } from "./client";
import { promoteUser } from "./roles";

const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;
const VERIFY_REPEAT_MS = 7 * 24 * 60 * 60_000;
const INVITE_LIST_LIMIT = 100;
const BROKER_LIST_LIMIT = 200;
// A real invite is opened a few times at most; this only stops a script guessing tokens.
const INVITE_CHECKS_PER_ADDRESS = 30;
const ADDRESS_WINDOW_MS = 60 * 60_000;
const TOKEN_FORMAT = /^[\w-]{43}$/;
const HASH_FORMAT = /^[0-9a-f]{64}$/;
const ID_FORMAT = /^[\w-]{1,40}$/;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type InviteStatus = "open" | "used" | "expired";

export interface InviteRow {
  /** The token's hash: what revoking names. The token itself is never stored. */
  id: string;
  branch: string;
  status: InviteStatus;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  usedBy: string | null;
}

export interface CurrentBroker {
  userId: string;
  name: string;
  phone: string;
  branch: string;
}

export interface BrokerProfile {
  photoUrl: string | null;
  bio: string | null;
  branch: string;
}

const inviteStatus = (usedAt: Date | null, expiresAt: Date, now: number): InviteStatus =>
  usedAt ? "used" : expiresAt.getTime() <= now ? "expired" : "open";

/**
 * Counts one invite check from a network. The same three conditional writes as the sign-in limits in auth.ts,
 * so parallel requests cannot pass it.
 */
export async function claimInviteCheck(ip: string, now = Date.now()): Promise<boolean> {
  const limits = db().codeRequestLimit;
  const ipHash = `invite:${addressHash(ip)}`;
  const opened = new Date(now);
  const claimed =
    (await limits.updateMany({ where: { ipHash, windowStart: { lte: new Date(now - ADDRESS_WINDOW_MS) } }, data: { windowStart: opened, count: 1 } })).count ||
    (await limits.updateMany({ where: { ipHash, count: { lt: INVITE_CHECKS_PER_ADDRESS } }, data: { count: { increment: 1 } } })).count ||
    (await limits.createMany({ data: [{ ipHash, windowStart: opened, count: 1 }], skipDuplicates: true })).count;
  return claimed > 0;
}

/** Makes a single-use link for 7 days and returns its token, which is shown once. Only its hash is kept. */
export async function createInvite(createdById: string, branchId: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db().agentInvite.create({
    data: { tokenHash: sha256(token), createdById, branchId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  return token;
}

/** The latest invites, newest first. */
export async function listInvites(): Promise<InviteRow[]> {
  const rows = await db().agentInvite.findMany({
    select: { tokenHash: true, createdAt: true, expiresAt: true, usedAt: true, branch: { select: { name: true } }, usedBy: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: INVITE_LIST_LIMIT,
  });
  const now = Date.now();
  return rows.map((row) => ({
    id: row.tokenHash,
    branch: row.branch?.name ?? "",
    status: inviteStatus(row.usedAt, row.expiresAt, now),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    usedBy: row.usedBy ? (row.usedBy.name ?? row.usedBy.phone) : null,
  }));
}

/** Takes back a link nobody has used yet. A used one stays, as the record of who joined. */
export async function revokeInvite(id: string): Promise<void> {
  if (!HASH_FORMAT.test(id)) return;
  await db().agentInvite.deleteMany({ where: { tokenHash: id, usedAt: null } });
}

/** Every branch, for choosing where an invited broker works. */
export function listInviteBranches(): Promise<{ id: string; name: string }[]> {
  return db().branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

/** Everyone with the broker role, with or without a public page. */
export async function listCurrentBrokers(): Promise<CurrentBroker[]> {
  const rows = await db().user.findMany({
    where: { role: "AGENT" },
    select: { id: true, name: true, phone: true, agent: { select: { branch: { select: { name: true } } } } },
    orderBy: { name: "asc" },
    take: BROKER_LIST_LIMIT,
  });
  return rows.map((row) => ({ userId: row.id, name: row.name ?? "", phone: row.phone ?? "", branch: row.agent?.branch?.name ?? "" }));
}

/** Makes a broker an ordinary user again. Only brokers: an admin's role is not changed here. */
export async function removeBroker(userId: string): Promise<void> {
  if (!ID_FORMAT.test(userId)) return;
  const client = db();
  const user = await client.user.findFirst({ where: { id: userId, role: "AGENT" }, select: { phone: true } });
  if (!user) return;
  // With a phone, promoteUser also hands their open chats to the listings' owners.
  // Without one they could not have posted, so they have no chats to hand over.
  if (user.phone) await promoteUser(client, user.phone, "USER");
  else await client.user.update({ where: { id: userId }, data: { role: "USER" } });
}

/** What a link is, without using it up. A token in the wrong shape is "missing" without asking the database. */
export async function checkInvite(token: string): Promise<{ status: InviteStatus | "missing"; branch: string }> {
  if (!TOKEN_FORMAT.test(token)) return { status: "missing", branch: "" };
  const row = await db().agentInvite.findUnique({
    where: { tokenHash: sha256(token) },
    select: { usedAt: true, expiresAt: true, branch: { select: { name: true } } },
  });
  if (!row) return { status: "missing", branch: "" };
  return { status: inviteStatus(row.usedAt, row.expiresAt, Date.now()), branch: row.branch?.name ?? "" };
}

export type AcceptResult = "accepted" | "invalid" | "already";

class Rollback extends Error {
  constructor(readonly result: AcceptResult) {
    super(result);
  }
}

/**
 * Uses up a link and makes the user a broker, in one transaction: an open link and an ordinary user, or nothing changes.
 * Like promoteUser with AGENT: the role, and a broker record, placed in the link's branch if it names one.
 */
export async function acceptInvite(userId: string, token: string): Promise<AcceptResult> {
  if (!TOKEN_FORMAT.test(token)) return "invalid";
  const now = new Date();
  try {
    await db().$transaction(async (tx) => {
      const invite = await tx.agentInvite.findUnique({ where: { tokenHash: sha256(token) }, select: { branchId: true } });
      if (!invite) throw new Rollback("invalid");
      // Conditional writes, so two people opening one link at once cannot both use it.
      const used = await tx.agentInvite.updateMany({
        where: { tokenHash: sha256(token), usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now, usedById: userId },
      });
      if (used.count === 0) throw new Rollback("invalid");
      const promoted = await tx.user.updateMany({ where: { id: userId, role: "USER" }, data: { role: "AGENT" } });
      if (promoted.count === 0) throw new Rollback("already");
      const branchId = invite.branchId ?? undefined;
      await tx.agent.upsert({ where: { userId }, create: { userId, branchId }, update: { branchId } });
    });
  } catch (error) {
    if (error instanceof Rollback) return error.result;
    throw error;
  }
  return "accepted";
}

/** A broker's photo, bio and branch, or null when the id is not a broker. */
export async function getBrokerProfile(agentId: string): Promise<BrokerProfile | null> {
  if (!ID_FORMAT.test(agentId)) return null;
  const row = await db().agent.findFirst({
    where: { id: agentId, user: { role: "AGENT" } },
    select: { photoUrl: true, bio: true, branch: { select: { name: true } } },
  });
  return row && { photoUrl: row.photoUrl, bio: row.bio, branch: row.branch?.name ?? "" };
}

/** Saves the broker's bio, and the photo when a new one was uploaded. An empty bio clears it. */
export async function saveBrokerProfile(agentId: string, bio: string, photoUrl?: string): Promise<void> {
  await db().agent.update({ where: { id: agentId }, data: { bio: bio || null, photoUrl } });
}

/**
 * An owner's request for a broker to visit and verify their listing, filed as a lead for the admin's queue.
 * Only the owner of an active listing nobody has verified and no broker handles. One request per listing in 7 days:
 * a repeat returns true without filing another.
 * ponytail: two clicks at the same instant can file two leads; harmless, a unique key on the note if it ever matters.
 */
export async function requestVerification(userId: string, listingId: number): Promise<boolean> {
  const client = db();
  const listing = await client.listing.findFirst({
    where: { id: listingId, ownerId: userId, status: "ACTIVE", verified: false, agentId: null },
    select: { deal: true, owner: { select: { name: true, phone: true } } },
  });
  if (!listing?.owner.phone) return false;
  const note = `Verify listing ${listingId}`;
  const recent = await client.lead.findFirst({
    where: { note, createdAt: { gte: new Date(Date.now() - VERIFY_REPEAT_MS) } },
    select: { id: true },
  });
  if (!recent) {
    const { name, phone } = listing.owner;
    await client.lead.create({ data: { name: name ?? phone, phone, deal: listing.deal, note } });
  }
  return true;
}
