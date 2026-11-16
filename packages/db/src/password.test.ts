import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  codeRequestLimit: { createMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  identity: { deleteMany: vi.fn() },
  session: { create: vi.fn(), deleteMany: vi.fn() },
  emailToken: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { Prisma } from "@prisma/client";
import {
  changePassword,
  checkPassword,
  claimEmailSend,
  createResetToken,
  getAccountSecurity,
  hashPassword,
  isResetTokenOpen,
  registerWithPassword,
  requestEmailChange,
  resetPassword,
  signInWithPassword,
  verifyEmail,
} from "./index";

const secret = "test-secret-that-is-long-enough-000";
const keyed = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const now = new Date("2026-11-16T10:00:00Z");
const email = "ana@example.com";
const ip = "203.0.113.7";
const taken = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });

/** The keys claimQuota was asked about, in order. */
const quotaKeys = () => [...new Set(prisma.codeRequestLimit.updateMany.mock.calls.map(([args]) => args.where.ipHash))];
/** Lets the n-th claimQuota call (0-based) fail and the others pass. */
const refuseQuota = (n: number) => {
  prisma.codeRequestLimit.updateMany.mockImplementation(async () => ({ count: 1 }));
  for (let call = 0; call < n; call++) prisma.codeRequestLimit.updateMany.mockResolvedValueOnce({ count: 1 });
  prisma.codeRequestLimit.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });
  prisma.codeRequestLimit.createMany.mockResolvedValue({ count: 0 });
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now, toFake: ["Date"] });
  vi.stubEnv("LOGIN_CODE_SECRET", secret);
  prisma.codeRequestLimit.updateMany.mockResolvedValue({ count: 1 });
  prisma.session.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async (run: (tx: typeof prisma) => unknown) => run(prisma));
  prisma.emailToken.create.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("hashPassword and checkPassword", () => {
  it("stores scrypt with its cost and a random salt, and checks it", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$[\w+/]{22}==\$[\w+/]{86}==$/);
    expect(await hashPassword("correct horse")).not.toBe(stored);
    expect(await checkPassword("correct horse", stored)).toBe(true);
    expect(await checkPassword("correct hors", stored)).toBe(false);
  });

  it("treats the same password typed in other Unicode forms as the same", async () => {
    expect(await checkPassword("café-password", await hashPassword("café-password"))).toBe(true);
  });

  it("refuses anything that is not a whole stored hash", async () => {
    expect(await checkPassword("x", "")).toBe(false);
    expect(await checkPassword("x", "scrypt$32768$8$1$c2FsdA==$=")).toBe(false);
    expect(await checkPassword("x", "bcrypt$2b$10$abc")).toBe(false);
  });
});

describe("signInWithPassword", () => {
  const emailLimitKey = `pw-email:${keyed(`ip:email:${email}`)}`;

  it("signs in with the right password, counting the address but not the email", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: await hashPassword("right password") });
    const result = await signInWithPassword(email, "right password", ip, "Firefox");
    expect(result).toEqual({ token: expect.any(String) });
    expect(prisma.session.create.mock.calls[0][0].data).toMatchObject({ userId: "u1", userAgent: "Firefox" });
    expect(quotaKeys()).toEqual([`pw:${keyed(`ip:${ip}`)}`]);
    expect(prisma.codeRequestLimit.findUnique).toHaveBeenCalledWith({ where: { ipHash: emailLimitKey }, select: { count: true, windowStart: true } });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email }, select: { id: true, passwordHash: true } });
  });

  it("gives the same answer for a wrong password, an unknown email and an account without a password, counting each against the email", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "u1", passwordHash: await hashPassword("right password") });
    expect(await signInWithPassword(email, "wrong password", ip)).toEqual({ error: "wrong" });
    expect(quotaKeys()).toEqual([`pw:${keyed(`ip:${ip}`)}`, emailLimitKey]);
    prisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await signInWithPassword(email, "wrong password", ip)).toEqual({ error: "wrong" });
    prisma.user.findUnique.mockResolvedValueOnce({ id: "u2", passwordHash: null });
    expect(await signInWithPassword(email, "wrong password", ip)).toEqual({ error: "wrong" });
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it("stops when the address has used up its attempts, or the email its wrong passwords this hour", async () => {
    refuseQuota(0);
    expect(await signInWithPassword(email, "x", ip)).toEqual({ error: "limited" });
    prisma.codeRequestLimit.updateMany.mockResolvedValue({ count: 1 });
    prisma.codeRequestLimit.findUnique.mockResolvedValueOnce({ count: 10, windowStart: new Date("2026-11-16T09:30:00Z") });
    expect(await signInWithPassword(email, "x", ip)).toEqual({ error: "limited" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("lets the email try again under the limit or once its hour is over", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.codeRequestLimit.findUnique.mockResolvedValueOnce({ count: 9, windowStart: new Date("2026-11-16T09:30:00Z") });
    expect(await signInWithPassword(email, "x", ip)).toEqual({ error: "wrong" });
    prisma.codeRequestLimit.findUnique.mockResolvedValueOnce({ count: 10, windowStart: new Date("2026-11-16T09:00:00Z") });
    expect(await signInWithPassword(email, "x", ip)).toEqual({ error: "wrong" });
  });
});

describe("registerWithPassword", () => {
  it("creates the user with a hashed password, a session and a 24-hour confirmation link", async () => {
    prisma.user.create.mockResolvedValue({ id: "u1" });
    const result = await registerWithPassword(email, "a long password", ip, "Firefox");
    expect(prisma.session.create.mock.calls[0][0].data).toMatchObject({ userId: "u1", userAgent: "Firefox" });
    if ("error" in result) throw new Error("expected a registration");
    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.email).toBe(email);
    expect(await checkPassword("a long password", data.passwordHash)).toBe(true);
    expect(prisma.emailToken.create).toHaveBeenCalledWith({
      data: { tokenHash: sha256(result.verifyToken), userId: "u1", purpose: "VERIFY", email, expiresAt: new Date("2026-11-17T10:00:00Z") },
    });
    expect(quotaKeys()).toEqual([`pw:${keyed(`ip:${ip}`)}`]);
  });

  it("says when the email has an account, and passes other failures on", async () => {
    prisma.user.create.mockRejectedValueOnce(taken);
    expect(await registerWithPassword(email, "a long password", ip)).toEqual({ error: "taken" });
    prisma.user.create.mockRejectedValueOnce(new Error("down"));
    await expect(registerWithPassword(email, "a long password", ip)).rejects.toThrow("down");
  });

  it("stops an address that registers too often", async () => {
    refuseQuota(0);
    expect(await registerWithPassword(email, "a long password", ip)).toEqual({ error: "limited" });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe("claimEmailSend", () => {
  it("counts per address and per recipient", async () => {
    expect(await claimEmailSend(ip, email, "VERIFY")).toBe(true);
    expect(quotaKeys()).toEqual([`mail:${keyed(`ip:${ip}`)}`, `mail-to-verify:${keyed(`ip:email:${email}`)}`]);
    refuseQuota(0);
    expect(await claimEmailSend(ip, email, "VERIFY")).toBe(false);
    refuseQuota(1);
    expect(await claimEmailSend(ip, email, "VERIFY")).toBe(false);
  });

  it("counts reset mail to a recipient apart from confirmation mail", async () => {
    expect(await claimEmailSend(ip, email, "RESET")).toBe(true);
    expect(quotaKeys()).toEqual([`mail:${keyed(`ip:${ip}`)}`, `mail-to-reset:${keyed(`ip:email:${email}`)}`]);
  });
});

describe("createResetToken", () => {
  it("makes a one-hour link for an existing account and nothing for an unknown email", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    const token = await createResetToken(email);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email, deletedAt: null }, select: { id: true } });
    expect(prisma.emailToken.create).toHaveBeenCalledWith({
      data: { tokenHash: sha256(String(token)), userId: "u1", purpose: "RESET", email, expiresAt: new Date("2026-11-16T11:00:00Z") },
    });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await createResetToken(email)).toBeNull();
  });
});

describe("email links", () => {
  const where = (purpose: string) => ({ tokenHash: sha256("tok"), purpose, usedAt: null, expiresAt: { gt: now } });
  const open = () => {
    prisma.emailToken.findFirst.mockResolvedValue({ userId: "u1", email });
    prisma.emailToken.updateMany.mockResolvedValue({ count: 1 });
  };

  it("checks whether a reset link is still open", async () => {
    prisma.emailToken.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect(await isResetTokenOpen("tok")).toBe(true);
    expect(await isResetTokenOpen("tok")).toBe(false);
    expect(prisma.emailToken.count).toHaveBeenCalledWith({ where: where("RESET") });
  });

  it("confirms the address the link went to, once, for its own account, and ends the account's other links", async () => {
    open();
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    expect(await verifyEmail("tok", "u1")).toBe("verified");
    expect(prisma.emailToken.findFirst).toHaveBeenCalledWith({ where: where("VERIFY"), select: { userId: true, email: true } });
    expect(prisma.emailToken.updateMany).toHaveBeenNthCalledWith(1, { where: where("VERIFY"), data: { usedAt: now } });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1", deletedAt: null }, data: { email, emailVerifiedAt: now } });
    expect(prisma.emailToken.updateMany).toHaveBeenNthCalledWith(2, { where: { userId: "u1", usedAt: null }, data: { usedAt: now } });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("leaves the link unused and the email unconfirmed when another account tries it, so a reset still hands the account over", async () => {
    open();
    expect(await verifyEmail("tok", "u2")).toBe("otherUser");
    expect(prisma.emailToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();

    prisma.user.findFirst.mockResolvedValue({ emailVerifiedAt: null });
    expect(await resetPassword("tok", "a new password")).toEqual(expect.any(String));
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ phone: null });
    expect(prisma.identity.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("refuses an unknown or old link, one used by a racing request, and a deleted account", async () => {
    prisma.emailToken.findFirst.mockResolvedValueOnce(null);
    expect(await verifyEmail("tok", "u1")).toBe("invalid");
    open();
    prisma.emailToken.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await verifyEmail("tok", "u1")).toBe("invalid");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await verifyEmail("tok", "u1")).toBe("invalid");
    // The account's other links stay as they were.
    expect(prisma.emailToken.updateMany).toHaveBeenCalledTimes(2);
  });

  it("says when another account has taken the address meanwhile, and passes other failures on", async () => {
    open();
    prisma.user.updateMany.mockRejectedValueOnce(taken);
    expect(await verifyEmail("tok", "u1")).toBe("taken");
    prisma.user.updateMany.mockRejectedValueOnce(new Error("down"));
    await expect(verifyEmail("tok", "u1")).rejects.toThrow("down");
  });

  const reset = (emailVerifiedAt: Date | null) => {
    open();
    prisma.user.findFirst.mockResolvedValue({ emailVerifiedAt });
  };

  it("resets the password of a confirmed account, keeping its other ways in, and replaces every session and link", async () => {
    reset(new Date("2026-01-01T00:00:00Z"));
    expect(await resetPassword("tok", "a new password", "Firefox")).toEqual(expect.any(String));
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { id: "u1", email, deletedAt: null }, select: { emailVerifiedAt: true } });
    const { where: userWhere, data } = prisma.user.update.mock.calls[0][0];
    expect(userWhere).toEqual({ id: "u1" });
    expect(data).toMatchObject({ emailVerifiedAt: now, phone: undefined, name: undefined, avatarUrl: undefined });
    expect(await checkPassword("a new password", data.passwordHash)).toBe(true);
    expect(prisma.identity.deleteMany).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.emailToken.updateMany).toHaveBeenLastCalledWith({ where: { userId: "u1", usedAt: null }, data: { usedAt: now } });
    expect(prisma.session.create.mock.calls[0][0].data).toMatchObject({ userId: "u1", userAgent: "Firefox" });
  });

  it("hands an unconfirmed account to the inbox owner: no phone, no Google, Facebook or Apple left", async () => {
    reset(null);
    expect(await resetPassword("tok", "a new password")).toEqual(expect.any(String));
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ emailVerifiedAt: now, phone: null, name: null, avatarUrl: null });
    expect(prisma.identity.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.emailToken.updateMany).toHaveBeenLastCalledWith({ where: { userId: "u1", usedAt: null }, data: { usedAt: now } });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("does nothing for a bad link or one sent to an address the account no longer has", async () => {
    prisma.emailToken.findFirst.mockResolvedValueOnce(null);
    expect(await resetPassword("tok", "a new password")).toBeNull();
    open();
    // Used by a request racing this one.
    prisma.emailToken.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await resetPassword("tok", "a new password")).toBeNull();
    prisma.user.findFirst.mockResolvedValue(null);
    expect(await resetPassword("tok", "a new password")).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(prisma.session.create).not.toHaveBeenCalled();
  });
});

describe("requestEmailChange", () => {
  it("makes a confirmation link for a free address, and resends to the user's own without a password", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "u1" });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ email: null, passwordHash: null }).mockResolvedValueOnce({ email, passwordHash: "h" });
    expect(await requestEmailChange("u1", email, "")).toEqual({ token: expect.any(String) });
    expect(await requestEmailChange("u1", email, "")).toEqual({ token: expect.any(String) });
    expect(prisma.emailToken.create.mock.calls[0][0].data).toMatchObject({ userId: "u1", purpose: "VERIFY", email });
    // Each new link ends the user's older confirmation links.
    expect(prisma.emailToken.updateMany).toHaveBeenCalledWith({ where: { userId: "u1", purpose: "VERIFY", usedAt: null }, data: { usedAt: now } });
    expect(prisma.emailToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(prisma.emailToken.create.mock.invocationCallOrder[0]);
  });

  it("needs the password to move the email of an account that has one", async () => {
    const passwordHash = await hashPassword("the password");
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findUniqueOrThrow.mockResolvedValue({ email: "old@example.com", passwordHash });
    expect(await requestEmailChange("u1", email, "not it")).toEqual({ error: "wrong" });
    expect(prisma.emailToken.create).not.toHaveBeenCalled();
    expect(await requestEmailChange("u1", email, "the password")).toEqual({ token: expect.any(String) });
    expect(quotaKeys()).toEqual(["pw-user:u1"]);
  });

  it("stops guessing the password after too many tries", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findUniqueOrThrow.mockResolvedValue({ email: "old@example.com", passwordHash: "scrypt$1$1$1$c2FsdA==$x" });
    refuseQuota(0);
    expect(await requestEmailChange("u1", email, "guess")).toEqual({ error: "limited" });
    expect(prisma.emailToken.create).not.toHaveBeenCalled();
  });

  it("refuses an address another account has", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "u2" });
    expect(await requestEmailChange("u1", email, "")).toEqual({ error: "taken" });
    expect(prisma.emailToken.create).not.toHaveBeenCalled();
  });
});

describe("changePassword", () => {
  it("sets a first password without asking for one, and replaces every session", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ passwordHash: null });
    expect(await changePassword("u1", "", "a new password", "Firefox")).toEqual({ token: expect.any(String) });
    expect(prisma.session.create.mock.calls[0][0].data).toMatchObject({ userId: "u1", userAgent: "Firefox" });
    expect(await checkPassword("a new password", prisma.user.update.mock.calls[0][0].data.passwordHash)).toBe(true);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.emailToken.updateMany).toHaveBeenLastCalledWith({ where: { userId: "u1", usedAt: null }, data: { usedAt: now } });
    expect(quotaKeys()).toEqual(["pw-user:u1"]);
  });

  it("needs the current password to change one", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ passwordHash: await hashPassword("the old password") });
    expect(await changePassword("u1", "not the old one", "a new password")).toEqual({ error: "wrong" });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(await changePassword("u1", "the old password", "a new password")).toEqual({ token: expect.any(String) });
  });

  it("stops after too many tries", async () => {
    refuseQuota(0);
    expect(await changePassword("u1", "", "a new password")).toEqual({ error: "limited" });
    expect(prisma.user.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("getAccountSecurity", () => {
  it("lists the email and the ways the user signs in", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ email, emailVerifiedAt: now, passwordHash: "h", phone: "+995555123456", identities: [{ provider: "GOOGLE" }] });
    expect(await getAccountSecurity("u1")).toEqual({ email, emailVerified: true, hasPassword: true, phone: "+995555123456", providers: ["GOOGLE"] });
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce({ email: null, emailVerifiedAt: null, passwordHash: null, phone: null, identities: [] });
    expect(await getAccountSecurity("u1")).toEqual({ email: null, emailVerified: false, hasPassword: false, phone: null, providers: [] });
  });
});
