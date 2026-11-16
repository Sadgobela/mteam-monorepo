import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { isIPv6 } from "node:net";
import { z } from "zod";
import { Prisma, type IdentityProvider } from "@prisma/client";
import { db } from "./client";

const CODE_TTL_MS = 5 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 60 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const LAST_SEEN_EVERY_MS = 60 * 60_000;
const USER_AGENT_MAX = 300;
// Generous, because Georgian mobile carriers put many customers behind one address. It exists to cap what a script can cost in SMS.
const CODES_PER_ADDRESS = 20;
const PHONE_LOOKUPS_PER_ADDRESS = 60;
// Each typed search costs an AI request, so a script must not be able to run up the bill.
const ASSISTANT_QUERIES_PER_ADDRESS = 30;
const ADDRESS_WINDOW_MS = 60 * 60_000;

const smsEnvSchema = z.object({ SMS_PROVIDER: z.enum(["console", "log"]) });

const EXAMPLE_SECRET = "replace-with-openssl-rand-hex-32";

const codeSecretSchema = z.object({
  LOGIN_CODE_SECRET: z
    .string()
    .min(32)
    .refine((secret) => process.env.NODE_ENV !== "production" || secret !== EXAMPLE_SECRET),
});

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Keyed, because there are only a million possible codes: a plain hash could be reversed from a leaked database in moments. */
const keyedHash = (value: string) => createHmac("sha256", codeSecretSchema.parse(process.env).LOGIN_CODE_SECRET).update(value).digest("hex");
const hashCode = (phone: string, code: string) => keyedHash(`${phone}:${code}`);

/**
 * Both write the code to the server log instead of sending an SMS.
 * - console: local testing only.
 * - log: also on the live site, for a private preview behind Vercel's login wall, where only the team reads the log.
 * ponytail: a real SMS provider goes here before the site opens to the public.
 */
function assertCodesCanBeSent(): void {
  const { SMS_PROVIDER } = smsEnvSchema.parse(process.env);
  if (SMS_PROVIDER === "console" && process.env.NODE_ENV === "production") throw new Error("SMS_PROVIDER=console is not allowed in production");
}

/** A keyed hash of the visitor's network, so addresses are never stored. */
export function addressHash(ip: string): string {
  return keyedHash(`ip:${addressBucket(ip)}`);
}

/** One customer on IPv6 is given a whole /64 block and can use a new address for every request, so the block is what gets counted. */
function addressBucket(ip: string): string {
  const embedded = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (embedded) return embedded[1];
  if (!isIPv6(ip)) return ip;
  const groups = (part: string) => (part ? part.split(":") : []);
  const [left, right = ""] = ip.split("::");
  const zeros = new Array(8 - groups(left).length - groups(right).length).fill("0");
  const block = [...groups(left), ...zeros, ...groups(right)].slice(0, 4);
  return `${block.map((group) => parseInt(group, 16).toString(16)).join(":")}::/64`;
}

/** Counts one use against a key and says whether it is within the limit. Single conditional writes, like the phone limit. */
async function claimQuota(ipHash: string, limit: number, now: number): Promise<boolean> {
  const limits = db().codeRequestLimit;
  const opened = new Date(now);
  const claimed =
    (
      await limits.updateMany({
        where: { ipHash, windowStart: { lte: new Date(now - ADDRESS_WINDOW_MS) } },
        data: { windowStart: opened, count: 1 },
      })
    ).count ||
    (await limits.updateMany({ where: { ipHash, count: { lt: limit } }, data: { count: { increment: 1 } } })).count ||
    (await limits.createMany({ data: [{ ipHash, windowStart: opened, count: 1 }], skipDuplicates: true })).count;
  return claimed > 0;
}

/** Enough for someone comparing flats, too few to walk through every listing's number. */
export function claimPhoneLookup(ip: string, now = Date.now()): Promise<boolean> {
  return claimQuota(`phone:${addressHash(ip)}`, PHONE_LOOKUPS_PER_ADDRESS, now);
}

/** Plenty for one person refining a search in the assistant, few enough to cap what a script can cost. */
export function claimAssistantQuery(ip: string, now = Date.now()): Promise<boolean> {
  return claimQuota(`ai:${addressHash(ip)}`, ASSISTANT_QUERIES_PER_ADDRESS, now);
}

/**
 * Issues a code for a normalized phone. Returns false if the address has asked for too many,
 * if one was sent to this phone less than a minute ago, or if the guesses are used up,
 * which locks the phone for an hour from the last code.
 * Each step is a single conditional write, so parallel requests cannot pass the limit.
 */
export async function requestLoginCode(phone: string, ip: string): Promise<boolean> {
  assertCodesCanBeSent();
  const client = db();
  const now = Date.now();
  if (!(await claimQuota(addressHash(ip), CODES_PER_ADDRESS, now))) return false;

  const code = String(randomInt(100_000, 1_000_000));
  const fresh = { codeHash: hashCode(phone, code), sentAt: new Date(now), expiresAt: new Date(now + CODE_TTL_MS) };

  const claimed =
    (
      await client.loginCode.updateMany({
        where: { phone, sentAt: { lte: new Date(now - ATTEMPT_WINDOW_MS) } },
        data: { ...fresh, attempts: 0 },
      })
    ).count ||
    (
      await client.loginCode.updateMany({
        where: { phone, sentAt: { lte: new Date(now - RESEND_AFTER_MS) }, attempts: { lt: MAX_ATTEMPTS } },
        data: fresh,
      })
    ).count ||
    (await client.loginCode.createMany({ data: [{ phone, ...fresh, attempts: 0 }], skipDuplicates: true })).count;
  if (!claimed) return false;

  console.info(`[login code] ${phone}: ${code}`);
  return true;
}

/** Uses up a code if it is right. Every check counts as a guess, so a phone locks after five wrong ones. */
async function useCode(phone: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const codeHash = hashCode(phone, code);
  const client = db();

  // Counting the attempt first means parallel guesses cannot get past the limit.
  const { count: open } = await client.loginCode.updateMany({
    where: { phone, attempts: { lt: MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  if (open === 0) return false;

  // Deleting on the hash makes a code single-use even if two requests race.
  const { count: matched } = await client.loginCode.deleteMany({ where: { phone, codeHash } });
  return matched > 0;
}

/**
 * Starts a session for a user who has just proved who they are, and returns the token for the cookie. Only a hash of the token is stored.
 * The browser's user agent, when given, lets the user tell their devices apart in settings; it is the client's own text, so it is cut short.
 */
export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await db().session.create({
    data: { tokenHash: sha256(token), userId, expiresAt: new Date(now + SESSION_TTL_MS), userAgent: userAgent?.slice(0, USER_AGENT_MAX), lastSeenAt: new Date(now) },
  });
  return token;
}

/** Checks a code and returns a new session token, or null. A user is created on first login. */
export async function verifyLoginCode(phone: string, code: string, userAgent?: string): Promise<string | null> {
  if (!(await useCode(phone, code))) return null;
  const user = await db().user.upsert({ where: { phone }, update: {}, create: { phone } });
  return createSession(user.id, userAgent);
}

/**
 * Signs in with an account at Google, Facebook or Apple and returns a session token. The first time makes a new user,
 * without a name: what the provider calls someone is not shown to others here.
 * Never matched to an existing user by email: Facebook does not promise the address was checked.
 */
export async function signInWithIdentity(provider: IdentityProvider, subject: string, userAgent?: string): Promise<string> {
  const identity = await db().identity.upsert({
    where: { provider_subject: { provider, subject } },
    update: {},
    create: { provider, subject, user: { create: {} } },
    select: { userId: true },
  });
  return createSession(identity.userId, userAgent);
}

export type AddPhoneResult = "added" | "wrongCode" | "taken";

/**
 * Gives a user who signed in with Google, Facebook or Apple a checked phone, which posting needs.
 * ponytail: a phone that already has its own account is refused; merging the two accounts waits until someone needs it.
 */
export async function addPhone(userId: string, phone: string, code: string): Promise<AddPhoneResult> {
  if (!(await useCode(phone, code))) return "wrongCode";
  try {
    // Only a user without a phone: one that has one already keeps it.
    const { count } = await db().user.updateMany({ where: { id: userId, phone: null }, data: { phone } });
    return count > 0 ? "added" : "taken";
  } catch (error) {
    // Another account has this phone: the unique constraint decides, also between two people adding it at once.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "taken";
    throw error;
  }
}

export async function getSessionUser(token: string) {
  const tokenHash = sha256(token);
  const session = await db().session.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, lastSeenAt: true, user: { select: { id: true, phone: true, role: true, name: true, avatarUrl: true, onboardedAt: true, deletedAt: true, agent: { select: { id: true } } } } },
  });
  const now = new Date();
  // A deleted account never signs in again, even through a session a sign-in created a moment after the deletion.
  if (!session || session.expiresAt <= now || session.user.deletedAt) return null;
  // Last seen, for the devices list in settings. Written at most once an hour, so nearly every request skips it,
  // and the condition is repeated in the write so parallel requests in that moment write once.
  const staleBefore = new Date(now.getTime() - LAST_SEEN_EVERY_MS);
  if (!session.lastSeenAt || session.lastSeenAt < staleBefore) {
    await db().session.updateMany({ where: { tokenHash, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleBefore } }] }, data: { lastSeenAt: now } });
  }
  const { deletedAt: _deleted, ...user } = session.user;
  return user;
}

export async function deleteSession(token: string): Promise<void> {
  await db().session.deleteMany({ where: { tokenHash: sha256(token) } });
}
