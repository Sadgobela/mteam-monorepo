import type { UserIntent } from "@prisma/client";
import { db } from "./client";

const ID = /^[\w-]{1,40}$/;
const HOUR_MS = 60 * 60_000;
const AVATARS_PER_HOUR = 10;

/** What other people may see of someone: never the phone or email. */
export interface PublicPerson {
  name: string | null;
  avatarUrl: string | null;
}

export interface Profile extends PublicPerson {
  intent: UserIntent | null;
  createdAt: Date;
}

export interface ProfileFields {
  name: string;
  intent: UserIntent;
}

const publicFields = { name: true, avatarUrl: true } as const;

/** The signed-in user's own profile. The session proves the account exists. */
export function getProfile(userId: string): Promise<Profile> {
  return db().user.findUniqueOrThrow({ where: { id: userId }, select: { ...publicFields, intent: true, createdAt: true } });
}

/** The first-visit answers. Choosing BROKER only records the wish; the role comes from an invite. */
export async function completeOnboarding(userId: string, fields: ProfileFields): Promise<void> {
  const now = new Date();
  await db().user.update({ where: { id: userId }, data: { ...fields, onboardedAt: now, termsAcceptedAt: now } });
}

export async function updateProfile(userId: string, fields: ProfileFields): Promise<void> {
  await db().user.update({ where: { id: userId }, data: fields });
}

// ponytail: the old photo stays in storage. Delete it here once storage has a delete call.
export async function setAvatar(userId: string, avatarUrl: string): Promise<void> {
  await db().user.update({ where: { id: userId }, data: { avatarUrl } });
}

/** A seller's name and photo, for their public page. */
export function getPublicPerson(userId: string): Promise<PublicPerson | null> {
  if (!ID.test(userId)) return Promise.resolve(null);
  return db().user.findUnique({ where: { id: userId }, select: publicFields });
}

/** The other person in a chat, or null unless this user is in it. */
export async function getChatPartner(userId: string, conversationId: string): Promise<PublicPerson | null> {
  if (!ID.test(conversationId)) return null;
  const row = await db().conversation.findFirst({
    where: { id: conversationId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: { buyerId: true, buyer: { select: publicFields }, seller: { select: publicFields } },
  });
  if (!row) return null;
  return row.buyerId === userId ? row.seller : row.buyer;
}

/**
 * Counts one photo upload and says whether it is within the hourly limit. The same single conditional writes as the
 * sign-in code limit in auth.ts, keyed by the account instead of the address.
 */
export async function claimAvatarUpload(userId: string, now = Date.now()): Promise<boolean> {
  const limits = db().codeRequestLimit;
  const ipHash = `avatar:${userId}`;
  const opened = new Date(now);
  const claimed =
    (await limits.updateMany({ where: { ipHash, windowStart: { lte: new Date(now - HOUR_MS) } }, data: { windowStart: opened, count: 1 } })).count ||
    (await limits.updateMany({ where: { ipHash, count: { lt: AVATARS_PER_HOUR } }, data: { count: { increment: 1 } } })).count ||
    (await limits.createMany({ data: [{ ipHash, windowStart: opened, count: 1 }], skipDuplicates: true })).count;
  return claimed > 0;
}
