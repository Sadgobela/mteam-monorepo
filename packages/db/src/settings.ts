import { createHash } from "node:crypto";
import { db } from "./client";

/** The account's switches in settings, each a column on User. */
export const PREFERENCE_KEYS = ["notifyMessages", "notifySavedSearches", "notifyPriceDrops", "notifyListingUpdates", "hidePhoneDefault"] as const;
export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];
export type Preferences = Record<PreferenceKey, boolean>;

export interface DeviceRow {
  /** The session's token hash: it cannot be turned back into the token, so it is safe in a form. */
  id: string;
  userAgent: string | null;
  lastSeenAt: Date;
  current: boolean;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const preferenceSelect = Object.fromEntries(PREFERENCE_KEYS.map((key) => [key, true])) as Record<PreferenceKey, true>;

export async function getPreferences(userId: string): Promise<Preferences> {
  return db().user.findUniqueOrThrow({ where: { id: userId }, select: preferenceSelect });
}

export async function setPreference(userId: string, key: PreferenceKey, value: boolean): Promise<void> {
  await db().user.update({ where: { id: userId }, data: { [key]: value } });
}

/** The user's live sessions, the most recently used first, with the one making this request marked. */
export async function listDevices(userId: string, currentToken: string): Promise<DeviceRow[]> {
  const current = sha256(currentToken);
  const rows = await db().session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { tokenHash: true, userAgent: true, lastSeenAt: true, createdAt: true },
    orderBy: [{ lastSeenAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({ id: row.tokenHash, userAgent: row.userAgent, lastSeenAt: row.lastSeenAt ?? row.createdAt, current: row.tokenHash === current }));
}

/** Signs out one of the user's other devices. Only their own, and never the one asking, which signs out the usual way. */
export async function signOutDevice(userId: string, id: string, currentToken: string): Promise<void> {
  await db().session.deleteMany({ where: { userId, tokenHash: { equals: id, not: sha256(currentToken) } } });
}

/** Signs out every device of the user except the one asking. */
export async function signOutOtherDevices(userId: string, currentToken: string): Promise<void> {
  await db().session.deleteMany({ where: { userId, tokenHash: { not: sha256(currentToken) } } });
}

/**
 * Removes a private person's account, keeping what others still need. Personal details are cleared and their sign-ins,
 * saved things and notifications deleted; their listings are archived; chats stay for the other person, where a user
 * without a name already shows as someone unnamed. One transaction, so it never half happens.
 * Brokers and admins are refused (false): their listings and work belong to MTeam, so an admin removes them.
 * The role is checked by the first write itself, so a promotion a moment earlier cannot slip through.
 */
export async function deleteAccount(userId: string): Promise<boolean> {
  return db().$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, role: "USER" },
      data: { name: null, phone: null, email: null, emailVerifiedAt: null, passwordHash: null, avatarUrl: null, deletedAt: new Date() },
    });
    if (count === 0) return false;
    const mine = { where: { userId } };
    await tx.identity.deleteMany(mine);
    await tx.session.deleteMany(mine);
    await tx.savedSearch.deleteMany(mine);
    await tx.favorite.deleteMany(mine);
    await tx.hiddenListing.deleteMany(mine);
    await tx.emailToken.deleteMany(mine);
    await tx.notification.deleteMany(mine);
    // A former broker keeps the Agent row their listings and checks point to, but not their photo or bio.
    await tx.agent.updateMany({ where: { userId }, data: { photoUrl: null, bio: null } });
    await tx.listing.updateMany({ where: { ownerId: userId, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
    return true;
  });
}
