import { createHash, randomBytes, scrypt, timingSafeEqual, type BinaryLike, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { Prisma, type EmailTokenPurpose, type IdentityProvider } from "@prisma/client";
import { addressHash, claimQuota, createSession } from "./auth";
import { db } from "./client";

// The typings promisify only the form without options; at run time the callback simply goes last.
const scryptAsync = promisify(scrypt) as (password: BinaryLike, salt: BinaryLike, keylen: number, options: ScryptOptions) => Promise<Buffer>;

// OWASP's floor for scrypt is N=2^17 with r=8; 2^15 keeps a sign-in near 100 ms on a small serverless function.
const COST = { N: 2 ** 15, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 64;
// The hash part is at least 16 bytes: an empty one would match every password.
const STORED = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w+/]+={0,2})\$([\w+/]{22,}={0,2})$/;

// Counted per hour, the window claimQuota uses.
const ATTEMPTS_PER_EMAIL = 10;
const ATTEMPTS_PER_ADDRESS = 20;
const ATTEMPTS_PER_USER = 10;
const EMAILS_PER_ADDRESS = 5;
const EMAILS_PER_RECIPIENT = 5;

const TOKEN_TTL_MS: Record<EmailTokenPurpose, number> = { VERIFY: 24 * 60 * 60_000, RESET: 60 * 60_000 };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Keys for the attempt limits. The email one is keyed too, so the table holds no list of tried addresses. */
const addressKey = (kind: string, ip: string) => `${kind}:${addressHash(ip)}`;
const emailKey = (kind: string, email: string) => `${kind}:${addressHash(`email:${email}`)}`;

async function derive(password: string, salt: Buffer, keyBytes: number, cost: typeof COST): Promise<Buffer> {
  // scrypt needs 128 * N * r bytes; the default ceiling of 32 MB is just too small for N=2^15.
  return scryptAsync(password.normalize("NFKC"), salt, keyBytes, { ...cost, maxmem: 256 * cost.N * cost.r });
}

/** `scrypt$N$r$p$salt$hash`, so the cost can be raised later without breaking stored passwords. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const parts = STORED.exec(stored);
  if (!parts) return false;
  const expected = Buffer.from(parts[5], "base64");
  const key = await derive(password, Buffer.from(parts[4], "base64"), expected.length, { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) });
  return timingSafeEqual(key, expected);
}

let dummyHash: Promise<string> | undefined;

/** Checked against when no account has the email, so an unknown address takes as long as a wrong password. */
const anyHash = () => (dummyHash ??= hashPassword(randomBytes(SALT_BYTES).toString("hex")));

const isTaken = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Ends every session and open email link of the user, after the password changed. A confirmation link kept by
 * someone who had the account could otherwise still move its email to them.
 */
async function endSessionsAndLinks(client: Prisma.TransactionClient, userId: string): Promise<void> {
  await client.session.deleteMany({ where: { userId } });
  await client.emailToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
}

async function claimAttempt(email: string, ip: string, now: number): Promise<boolean> {
  return (await claimQuota(addressKey("pw", ip), ATTEMPTS_PER_ADDRESS, now)) && claimQuota(emailKey("pw-email", email), ATTEMPTS_PER_EMAIL, now);
}

export type PasswordSignIn = { token: string } | { error: "wrong" | "limited" };

/** Signs in with a normalized email and a password. An unknown email and a wrong password look the same, in answer and in time. */
export async function signInWithPassword(email: string, password: string, ip: string, userAgent?: string): Promise<PasswordSignIn> {
  if (!(await claimAttempt(email, ip, Date.now()))) return { error: "limited" };
  const user = await db().user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  const matches = await checkPassword(password, user?.passwordHash ?? (await anyHash()));
  return user?.passwordHash && matches ? { token: await createSession(user.id, userAgent) } : { error: "wrong" };
}

export type Registration = { token: string; verifyToken: string } | { error: "taken" | "limited" };

/** A new user with a normalized email and a password, signed in at once. The email is confirmed later by the link in `verifyToken`. */
export async function registerWithPassword(email: string, password: string, ip: string, userAgent?: string): Promise<Registration> {
  if (!(await claimQuota(addressKey("pw", ip), ATTEMPTS_PER_ADDRESS, Date.now()))) return { error: "limited" };
  const passwordHash = await hashPassword(password);
  try {
    const user = await db().user.create({ data: { email, passwordHash }, select: { id: true } });
    return { token: await createSession(user.id, userAgent), verifyToken: await createEmailToken(user.id, "VERIFY", email) };
  } catch (error) {
    if (isTaken(error)) return { error: "taken" };
    throw error;
  }
}

/** Whether another email may go out from this address to this recipient. Each email costs, and must not become a way to flood an inbox. */
export async function claimEmailSend(ip: string, email: string, now = Date.now()): Promise<boolean> {
  return (await claimQuota(addressKey("mail", ip), EMAILS_PER_ADDRESS, now)) && claimQuota(emailKey("mail-to", email), EMAILS_PER_RECIPIENT, now);
}

/** A single-use link token for `email`. Only its hash is stored. */
export async function createEmailToken(userId: string, purpose: EmailTokenPurpose, email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db().emailToken.create({ data: { tokenHash: sha256(token), userId, purpose, email, expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]) } });
  return token;
}

/** A reset link token for the account with this email, or null when there is none. */
export async function createResetToken(email: string): Promise<string | null> {
  const user = await db().user.findUnique({ where: { email, deletedAt: null }, select: { id: true } });
  return user ? createEmailToken(user.id, "RESET", email) : null;
}

const openToken = (token: string, purpose: EmailTokenPurpose) => ({ tokenHash: sha256(token), purpose, usedAt: null, expiresAt: { gt: new Date() } });

/** Uses up a token and returns what it was for, or null when it is unknown, used or old. Single use even if two requests race. */
async function useToken(token: string, purpose: EmailTokenPurpose) {
  const where = openToken(token, purpose);
  const row = await db().emailToken.findFirst({ where, select: { userId: true, email: true } });
  if (!row) return null;
  const { count } = await db().emailToken.updateMany({ where, data: { usedAt: new Date() } });
  return count > 0 ? row : null;
}

/** Whether a reset link can still be used, to show its form or say it has run out. */
export async function isResetTokenOpen(token: string): Promise<boolean> {
  return (await db().emailToken.count({ where: openToken(token, "RESET") })) > 0;
}

export type EmailVerification = "verified" | "invalid" | "taken" | "otherUser";

/**
 * Confirms the address a VERIFY link was sent to, making it the account's email: a changed address only takes over once
 * confirmed. Only the account the link belongs to may confirm, signed in: a mail scanner, or the inbox owner while someone
 * else holds the account, must not confirm it, or a later reset would no longer hand the account to the inbox owner.
 * Another user's attempt leaves the link unused. Confirming ends the account's other open links, so an older one cannot
 * move the email back.
 */
export async function verifyEmail(token: string, userId: string): Promise<EmailVerification> {
  const where = openToken(token, "VERIFY");
  const row = await db().emailToken.findFirst({ where, select: { userId: true, email: true } });
  if (!row) return "invalid";
  if (row.userId !== userId) return "otherUser";
  try {
    return await db().$transaction(async (tx) => {
      const now = new Date();
      const { count: used } = await tx.emailToken.updateMany({ where, data: { usedAt: now } });
      if (used === 0) return "invalid";
      const { count: updated } = await tx.user.updateMany({ where: { id: userId, deletedAt: null }, data: { email: row.email, emailVerifiedAt: now } });
      if (updated === 0) return "invalid";
      await tx.emailToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
      return "verified";
    });
  } catch (error) {
    // Someone else confirmed or registered this address in the meantime.
    if (isTaken(error)) return "taken";
    throw error;
  }
}

/**
 * Sets a new password from a RESET link, ends every session and open email link, and returns a fresh session, or null
 * for a bad link. Opening the link proves the inbox, so the email counts as confirmed. A link sent to an address the
 * account no longer has does nothing.
 * When the email was not confirmed yet, the inbox owner takes the account over cleanly: its phone, Google, Facebook
 * and Apple sign-ins, name and photo are removed, so whoever registered someone else's address keeps no way in and
 * leaves nothing of theirs on it.
 */
export async function resetPassword(token: string, password: string, userAgent?: string): Promise<string | null> {
  const row = await useToken(token, "RESET");
  if (!row) return null;
  const passwordHash = await hashPassword(password);
  const reset = await db().$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id: row.userId, email: row.email, deletedAt: null }, select: { emailVerifiedAt: true } });
    if (!user) return false;
    const takeover = user.emailVerifiedAt === null;
    // undefined leaves a field as it is.
    const wiped = takeover ? null : undefined;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, emailVerifiedAt: new Date(), phone: wiped, name: wiped, avatarUrl: wiped } });
    if (takeover) await tx.identity.deleteMany({ where: { userId: row.userId } });
    await endSessionsAndLinks(tx, row.userId);
    return true;
  });
  return reset ? createSession(row.userId, userAgent) : null;
}

export type EmailChange = { token: string } | { error: "taken" | "wrong" | "limited" };

/**
 * Starts confirming a new address for a user, or a resend for the current one. Moving the email of an account with a
 * password needs that password, or a borrowed session could take the account over through a reset.
 */
export async function requestEmailChange(userId: string, email: string, current: string): Promise<EmailChange> {
  const owner = await db().user.findUnique({ where: { email }, select: { id: true } });
  if (owner && owner.id !== userId) return { error: "taken" };
  const user = await db().user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, passwordHash: true } });
  if (user.email !== email && user.passwordHash) {
    // Counted with password changes, so a borrowed session cannot guess the password here either.
    if (!(await claimQuota(`pw-user:${userId}`, ATTEMPTS_PER_USER, Date.now()))) return { error: "limited" };
    if (!(await checkPassword(current, user.passwordHash))) return { error: "wrong" };
  }
  // Only the newest confirmation link works, so an older one cannot move the email back to a former address.
  await db().emailToken.updateMany({ where: { userId, purpose: "VERIFY", usedAt: null }, data: { usedAt: new Date() } });
  return { token: await createEmailToken(userId, "VERIFY", email) };
}

export type PasswordChange = { token: string } | { error: "wrong" | "limited" };

/** Sets or changes a password. The current one is needed when there is one. Ends every session and open email link, and returns a fresh session. */
export async function changePassword(userId: string, current: string, next: string, userAgent?: string): Promise<PasswordChange> {
  if (!(await claimQuota(`pw-user:${userId}`, ATTEMPTS_PER_USER, Date.now()))) return { error: "limited" };
  const user = await db().user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (user.passwordHash && !(await checkPassword(current, user.passwordHash))) return { error: "wrong" };
  await db().user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await endSessionsAndLinks(db(), userId);
  return { token: await createSession(userId, userAgent) };
}

export interface AccountSecurity {
  email: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  phone: string | null;
  providers: IdentityProvider[];
}

/** What the security page shows: the email and the ways this user can sign in. */
export async function getAccountSecurity(userId: string): Promise<AccountSecurity> {
  const user = await db().user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true, passwordHash: true, phone: true, identities: { select: { provider: true } } },
  });
  return {
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    hasPassword: user.passwordHash !== null,
    phone: user.phone,
    providers: user.identities.map((identity) => identity.provider),
  };
}
