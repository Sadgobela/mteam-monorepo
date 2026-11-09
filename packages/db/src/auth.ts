import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "./client";

const CODE_TTL_MS = 5 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 60 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
// Generous, because Georgian mobile carriers put many customers behind one address. It exists to cap what a script can cost in SMS.
const CODES_PER_ADDRESS = 20;
const ADDRESS_WINDOW_MS = 60 * 60_000;

const smsEnvSchema = z.object({ SMS_PROVIDER: z.literal("console") });

const codeSecretSchema = z.object({ LOGIN_CODE_SECRET: z.string().min(32) });

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Keyed, because there are only a million possible codes: a plain hash could be reversed from a leaked database in moments. */
const keyedHash = (value: string) => createHmac("sha256", codeSecretSchema.parse(process.env).LOGIN_CODE_SECRET).update(value).digest("hex");
const hashCode = (phone: string, code: string) => keyedHash(`${phone}:${code}`);

// ponytail: console only, for local testing. A real provider goes here before launch.
function assertCodesCanBeSent(): void {
  smsEnvSchema.parse(process.env);
  if (process.env.NODE_ENV === "production") throw new Error("SMS_PROVIDER=console is not allowed in production");
}

/** Counts one code request against an address and says whether it is within the limit. Single conditional writes, like the phone limit. */
async function claimAddressQuota(ip: string, now: number): Promise<boolean> {
  const limits = db().codeRequestLimit;
  const ipHash = keyedHash(`ip:${ip}`);
  const opened = new Date(now);
  const claimed =
    (
      await limits.updateMany({
        where: { ipHash, windowStart: { lte: new Date(now - ADDRESS_WINDOW_MS) } },
        data: { windowStart: opened, count: 1 },
      })
    ).count ||
    (await limits.updateMany({ where: { ipHash, count: { lt: CODES_PER_ADDRESS } }, data: { count: { increment: 1 } } })).count ||
    (await limits.createMany({ data: [{ ipHash, windowStart: opened, count: 1 }], skipDuplicates: true })).count;
  return claimed > 0;
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
  if (!(await claimAddressQuota(ip, now))) return false;

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

/** Checks a code and returns a new session token, or null. A user is created on first login. */
export async function verifyLoginCode(phone: string, code: string): Promise<string | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const codeHash = hashCode(phone, code);
  const client = db();
  const now = new Date();

  // Counting the attempt first means parallel guesses cannot get past the limit.
  const { count: open } = await client.loginCode.updateMany({
    where: { phone, attempts: { lt: MAX_ATTEMPTS }, expiresAt: { gt: now } },
    data: { attempts: { increment: 1 } },
  });
  if (open === 0) return null;

  // Deleting on the hash makes a code single-use even if two requests race.
  const { count: matched } = await client.loginCode.deleteMany({ where: { phone, codeHash } });
  if (matched === 0) return null;

  const user = await client.user.upsert({ where: { phone }, update: {}, create: { phone } });
  const token = randomBytes(32).toString("base64url");
  await client.session.create({
    data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
  });
  return token;
}

export async function getSessionUser(token: string) {
  const session = await db().session.findUnique({
    where: { tokenHash: sha256(token) },
    select: { expiresAt: true, user: { select: { id: true, phone: true, role: true, agent: { select: { id: true } } } } },
  });
  return session && session.expiresAt > new Date() ? session.user : null;
}

export async function deleteSession(token: string): Promise<void> {
  await db().session.deleteMany({ where: { tokenHash: sha256(token) } });
}
