import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  loginCode: { createMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  codeRequestLimit: { createMany: vi.fn(), updateMany: vi.fn() },
  user: { upsert: vi.fn(), updateMany: vi.fn() },
  identity: { upsert: vi.fn() },
  session: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { Prisma } from "@prisma/client";
import { addPhone, claimPhoneLookup, deleteSession, getSessionUser, requestLoginCode, signInWithIdentity, verifyLoginCode } from "./index";

const phone = "+995555123456";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = "test-secret-that-is-long-enough-000";
const keyed = (value: string, key = secret) => createHmac("sha256", key).update(value).digest("hex");
const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  prisma.loginCode.updateMany.mockReset();
  prisma.codeRequestLimit.updateMany.mockReset();
  prisma.codeRequestLimit.updateMany.mockResolvedValue({ count: 1 });
  vi.useFakeTimers({ now: new Date("2026-11-09T10:00:00Z") });
  vi.stubEnv("SMS_PROVIDER", "console");
  vi.stubEnv("LOGIN_CODE_SECRET", secret);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("requestLoginCode", () => {
  const sentCode = () => String(log.mock.calls[0][0]).split(": ")[1];
  const outcome = (stale: number, resendable: number, created: number) => {
    prisma.loginCode.updateMany.mockResolvedValueOnce({ count: stale }).mockResolvedValueOnce({ count: resendable });
    prisma.loginCode.createMany.mockResolvedValue({ count: created });
  };

  it("creates a row holding only a hash of a six-digit code for a new phone", async () => {
    outcome(0, 0, 1);
    expect(await requestLoginCode(phone, "203.0.113.7")).toBe(true);

    const code = sentCode();
    expect(code).toMatch(/^\d{6}$/);
    const { data, skipDuplicates } = prisma.loginCode.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data[0]).toEqual({
      phone,
      codeHash: keyed(`${phone}:${code}`),
      sentAt: new Date("2026-11-09T10:00:00Z"),
      expiresAt: new Date("2026-11-09T10:05:00Z"),
      attempts: 0,
    });
  });

  it("clears the guesses only once the hour has passed", async () => {
    outcome(1, 0, 0);
    expect(await requestLoginCode(phone, "203.0.113.7")).toBe(true);
    const { where, data } = prisma.loginCode.updateMany.mock.calls[0][0];
    expect(where).toEqual({ phone, sentAt: { lte: new Date("2026-11-09T09:00:00Z") } });
    expect(data.attempts).toBe(0);
    expect(prisma.loginCode.updateMany).toHaveBeenCalledOnce();
    expect(prisma.loginCode.createMany).not.toHaveBeenCalled();
  });

  it("resends after a minute but carries the guesses over", async () => {
    outcome(0, 1, 0);
    expect(await requestLoginCode(phone, "203.0.113.7")).toBe(true);
    const { where, data } = prisma.loginCode.updateMany.mock.calls[1][0];
    expect(where).toEqual({ phone, sentAt: { lte: new Date("2026-11-09T09:59:00Z") }, attempts: { lt: 5 } });
    expect(data).not.toHaveProperty("attempts");
    expect(data.codeHash).toBe(keyed(`${phone}:${sentCode()}`));
    expect(prisma.loginCode.createMany).not.toHaveBeenCalled();
  });

  describe("per-address limit", () => {
    const quota = (stale: number, below: number, created: number) => {
      prisma.codeRequestLimit.updateMany.mockReset();
      prisma.codeRequestLimit.updateMany.mockResolvedValueOnce({ count: stale }).mockResolvedValueOnce({ count: below });
      prisma.codeRequestLimit.createMany.mockResolvedValue({ count: created });
    };
    const ipHash = keyed("ip:203.0.113.7");

    it.each([
      ["2001:db8:1:2:aaaa::1", "2001:db8:1:2::/64"],
      ["2001:0DB8:0001:0002:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64"],
      ["2001:db8::1", "2001:db8:0:0::/64"],
      ["2001:db8:1:3::", "2001:db8:1:3::/64"],
      ["::1", "0:0:0:0::/64"],
      ["::ffff:203.0.113.7", "203.0.113.7"],
      ["203.0.113.7", "203.0.113.7"],
      ["unknown", "unknown"],
    ])("counts %s under %s", async (ip, bucket) => {
      quota(0, 1, 0);
      outcome(0, 0, 1);
      await requestLoginCode(phone, ip);
      expect(prisma.codeRequestLimit.updateMany.mock.calls[0][0].where.ipHash).toBe(keyed(`ip:${bucket}`));
    });

    it("opens a new window for an address it has not seen, storing only a keyed hash", async () => {
      quota(0, 0, 1);
      outcome(0, 0, 1);
      expect(await requestLoginCode(phone, "203.0.113.7")).toBe(true);
      expect(prisma.codeRequestLimit.createMany.mock.calls[0][0]).toEqual({
        data: [{ ipHash, windowStart: new Date("2026-11-09T10:00:00Z"), count: 1 }],
        skipDuplicates: true,
      });
    });

    it("restarts the count once the hour has passed", async () => {
      quota(1, 0, 0);
      outcome(0, 0, 1);
      expect(await requestLoginCode(phone, "203.0.113.7")).toBe(true);
      expect(prisma.codeRequestLimit.updateMany.mock.calls[0][0]).toEqual({
        where: { ipHash, windowStart: { lte: new Date("2026-11-09T09:00:00Z") } },
        data: { windowStart: new Date("2026-11-09T10:00:00Z"), count: 1 },
      });
      expect(prisma.codeRequestLimit.updateMany).toHaveBeenCalledOnce();
    });

    it("counts a request only while the address is under the limit", async () => {
      quota(0, 1, 0);
      outcome(0, 0, 1);
      expect(await requestLoginCode(phone, "203.0.113.7")).toBe(true);
      expect(prisma.codeRequestLimit.updateMany.mock.calls[1][0]).toEqual({
        where: { ipHash, count: { lt: 20 } },
        data: { count: { increment: 1 } },
      });
      expect(prisma.codeRequestLimit.createMany).not.toHaveBeenCalled();
    });

    it("sends nothing and leaves the phone's code alone once the address is over the limit", async () => {
      quota(0, 0, 0);
      expect(await requestLoginCode(phone, "203.0.113.7")).toBe(false);
      expect(log).not.toHaveBeenCalled();
      expect(prisma.loginCode.updateMany).not.toHaveBeenCalled();
      expect(prisma.loginCode.createMany).not.toHaveBeenCalled();
    });
  });

  it("sends nothing when too soon or locked", async () => {
    outcome(0, 0, 0);
    expect(await requestLoginCode(phone, "203.0.113.7")).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    ["without the console provider", "SMS_PROVIDER", undefined],
    ["in production", "NODE_ENV", "production"],
    ["without the secret", "LOGIN_CODE_SECRET", undefined],
    ["with a secret too short to protect anything", "LOGIN_CODE_SECRET", "short"],
  ])("refuses to issue a code %s, before any write", async (_name, key, value) => {
    vi.stubEnv(key, value as string);
    await expect(requestLoginCode(phone, "203.0.113.7")).rejects.toThrow();
    expect(log).not.toHaveBeenCalled();
    expect(prisma.loginCode.updateMany).not.toHaveBeenCalled();
    expect(prisma.loginCode.createMany).not.toHaveBeenCalled();
  });
});

describe("verifyLoginCode", () => {
  const open = () => prisma.loginCode.updateMany.mockResolvedValue({ count: 1 });

  it.each(["", "12345", "1234567", "abcdef"])("rejects malformed code %j without touching the database", async (code) => {
    expect(await verifyLoginCode(phone, code)).toBeNull();
    expect(prisma.loginCode.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to check a code without the secret, before counting a guess", async () => {
    vi.stubEnv("LOGIN_CODE_SECRET", undefined as unknown as string);
    await expect(verifyLoginCode(phone, "123456")).rejects.toThrow();
    expect(prisma.loginCode.updateMany).not.toHaveBeenCalled();
  });

  it("refuses the published example secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOGIN_CODE_SECRET", "replace-with-openssl-rand-hex-32");
    await expect(verifyLoginCode(phone, "123456")).rejects.toThrow();
    expect(prisma.loginCode.updateMany).not.toHaveBeenCalled();
  });

  it("accepts a real secret in production and the example one locally", async () => {
    open();
    prisma.loginCode.deleteMany.mockResolvedValue({ count: 0 });
    vi.stubEnv("NODE_ENV", "production");
    expect(await verifyLoginCode(phone, "123456")).toBeNull();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOGIN_CODE_SECRET", "replace-with-openssl-rand-hex-32");
    expect(await verifyLoginCode(phone, "123456")).toBeNull();
  });

  it("depends on the secret, so a leaked hash cannot be checked without it", async () => {
    open();
    prisma.loginCode.deleteMany.mockResolvedValue({ count: 0 });
    vi.stubEnv("LOGIN_CODE_SECRET", "a-completely-different-secret-value-1");
    await verifyLoginCode(phone, "123456");
    const { where } = prisma.loginCode.deleteMany.mock.calls[0][0];
    expect(where.codeHash).toBe(keyed(`${phone}:123456`, "a-completely-different-secret-value-1"));
    expect(where.codeHash).not.toBe(keyed(`${phone}:123456`));
    expect(where.codeHash).not.toBe(sha256(`${phone}:123456`));
  });

  it("only counts attempts on a live code below the limit", async () => {
    prisma.loginCode.updateMany.mockResolvedValue({ count: 0 });
    expect(await verifyLoginCode(phone, "123456")).toBeNull();
    expect(prisma.loginCode.updateMany.mock.calls[0][0]).toEqual({
      where: { phone, attempts: { lt: 5 }, expiresAt: { gt: new Date("2026-11-09T10:00:00Z") } },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.loginCode.deleteMany).not.toHaveBeenCalled();
  });

  it("creates no session for a wrong code", async () => {
    open();
    prisma.loginCode.deleteMany.mockResolvedValue({ count: 0 });
    expect(await verifyLoginCode(phone, "123456")).toBeNull();
    expect(prisma.loginCode.deleteMany.mock.calls[0][0]).toEqual({
      where: { phone, codeHash: keyed(`${phone}:123456`) },
    });
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it("signs in on the right code and stores only a hash of the token", async () => {
    open();
    prisma.loginCode.deleteMany.mockResolvedValue({ count: 1 });
    prisma.user.upsert.mockResolvedValue({ id: "u1" });
    const token = await verifyLoginCode(phone, "123456");

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(prisma.user.upsert.mock.calls[0][0]).toEqual({ where: { phone }, update: {}, create: { phone } });
    expect(prisma.session.create.mock.calls[0][0].data).toEqual({
      tokenHash: sha256(token as string),
      userId: "u1",
      expiresAt: new Date("2026-12-09T10:00:00Z"),
    });
  });
});

describe("signInWithIdentity", () => {
  it("signs in as the user linked to the account, making one the first time", async () => {
    prisma.identity.upsert.mockResolvedValue({ userId: "u7" });
    const token = await signInWithIdentity("GOOGLE", "g-123");
    expect(prisma.identity.upsert.mock.calls[0][0]).toEqual({
      where: { provider_subject: { provider: "GOOGLE", subject: "g-123" } },
      update: {},
      create: { provider: "GOOGLE", subject: "g-123", user: { create: {} } },
      select: { userId: true },
    });
    expect(prisma.session.create.mock.calls[0][0].data).toEqual({
      tokenHash: sha256(token),
      userId: "u7",
      expiresAt: new Date("2026-12-09T10:00:00Z"),
    });
  });
});

describe("addPhone", () => {
  const right = () => {
    prisma.loginCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.loginCode.deleteMany.mockResolvedValue({ count: 1 });
  };
  const unique = new Prisma.PrismaClientKnownRequestError("taken", { code: "P2002", clientVersion: "6" });

  it("does not touch the user for a wrong code", async () => {
    prisma.loginCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.loginCode.deleteMany.mockResolvedValue({ count: 0 });
    expect(await addPhone("u7", phone, "123456")).toBe("wrongCode");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("adds the checked phone to a user who has none", async () => {
    right();
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    expect(await addPhone("u7", phone, "123456")).toBe("added");
    expect(prisma.user.updateMany.mock.calls[0][0]).toEqual({ where: { id: "u7", phone: null }, data: { phone } });
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it("keeps a phone the user already has", async () => {
    right();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    expect(await addPhone("u7", phone, "123456")).toBe("taken");
  });

  it("refuses a phone that has its own account", async () => {
    right();
    prisma.user.updateMany.mockRejectedValue(unique);
    expect(await addPhone("u7", phone, "123456")).toBe("taken");
  });

  it("passes other database errors on", async () => {
    right();
    prisma.user.updateMany.mockRejectedValue(new Error("down"));
    await expect(addPhone("u7", phone, "123456")).rejects.toThrow("down");
  });
});

describe("sessions", () => {
  const user = { id: "u1", phone, role: "USER" };

  it("returns the user of a live session, looked up by hash", async () => {
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2026-11-09T10:00:01Z"), user });
    expect(await getSessionUser("tok")).toEqual(user);
    expect(prisma.session.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: sha256("tok") });
  });

  it("ignores an expired session", async () => {
    prisma.session.findUnique.mockResolvedValue({ expiresAt: new Date("2026-11-09T10:00:00Z"), user });
    expect(await getSessionUser("tok")).toBeNull();
  });

  it("ignores an unknown token", async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    expect(await getSessionUser("tok")).toBeNull();
  });

  it("deletes by hash", async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 1 });
    await deleteSession("tok");
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: sha256("tok") } });
  });
});

describe("claimPhoneLookup", () => {
  it("counts lookups separately from login codes, and refuses past the limit", async () => {
    prisma.codeRequestLimit.updateMany.mockReset();
    prisma.codeRequestLimit.updateMany.mockResolvedValue({ count: 1 });
    expect(await claimPhoneLookup("1.2.3.4", 1000)).toBe(true);
    expect(prisma.codeRequestLimit.updateMany.mock.calls[0][0].where.ipHash).toMatch(/^phone:/);
    prisma.codeRequestLimit.updateMany.mockResolvedValue({ count: 0 });
    prisma.codeRequestLimit.createMany.mockResolvedValue({ count: 0 });
    expect(await claimPhoneLookup("1.2.3.4", 1000)).toBe(false);
  });

  it("uses the current time by default", async () => {
    prisma.codeRequestLimit.updateMany.mockReset();
    prisma.codeRequestLimit.updateMany.mockResolvedValue({ count: 1 });
    expect(await claimPhoneLookup("1.2.3.4")).toBe(true);
  });
});
