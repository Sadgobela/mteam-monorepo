import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  codeRequestLimit: { createMany: vi.fn(), updateMany: vi.fn() },
  agentInvite: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  branch: { findMany: vi.fn() },
  user: { findMany: vi.fn(), updateMany: vi.fn() },
  agent: { findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  listing: { findFirst: vi.fn() },
  lead: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));
const roles = vi.hoisted(() => ({ handBackChats: vi.fn() }));

vi.mock("./client", () => ({ db: () => prisma }));
vi.mock("./roles", () => roles);

import {
  acceptInvite,
  checkInvite,
  claimInviteCheck,
  createInvite,
  getBrokerProfile,
  listCurrentBrokers,
  listInviteBranches,
  listInvites,
  removeBroker,
  requestVerification,
  revokeInvite,
  saveBrokerProfile,
} from "./index";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = "test-secret-that-is-long-enough-000";
const token = "a".repeat(43);
const hash = sha256(token);
const now = new Date("2026-11-16T10:00:00Z");
const day = 24 * 60 * 60_000;

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now });
  vi.stubEnv("LOGIN_CODE_SECRET", secret);
  prisma.$transaction.mockImplementation(async (run: (tx: typeof prisma) => Promise<unknown>) => run(prisma));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("claimInviteCheck", () => {
  it.each([
    [1, 0, 0, true],
    [0, 1, 0, true],
    [0, 0, 1, true],
    [0, 0, 0, false],
  ])("counts a check per network (stale %i, below %i, new %i)", async (stale, below, created, allowed) => {
    prisma.codeRequestLimit.updateMany.mockResolvedValueOnce({ count: stale }).mockResolvedValueOnce({ count: below });
    prisma.codeRequestLimit.createMany.mockResolvedValue({ count: created });
    expect(await claimInviteCheck("10.0.0.1")).toBe(allowed);
    const ipHash = `invite:${createHmac("sha256", secret).update("ip:10.0.0.1").digest("hex")}`;
    expect(prisma.codeRequestLimit.updateMany.mock.calls[0][0].where).toEqual({ ipHash, windowStart: { lte: new Date(now.getTime() - 60 * 60_000) } });
  });
});

describe("invites", () => {
  it("stores only the hash of a new token, valid for 7 days", async () => {
    const created = await createInvite("admin", "b1");
    expect(created).toMatch(/^[\w-]{43}$/);
    expect(prisma.agentInvite.create).toHaveBeenCalledWith({
      data: { tokenHash: sha256(created), createdById: "admin", branchId: "b1", expiresAt: new Date(now.getTime() + 7 * day) },
    });
  });

  it("lists open, used and expired links", async () => {
    const base = { createdAt: now, branch: null, usedBy: null, usedAt: null };
    prisma.agentInvite.findMany.mockResolvedValue([
      { ...base, tokenHash: "h1", expiresAt: new Date(now.getTime() + day), branch: { name: "Vake" } },
      { ...base, tokenHash: "h2", expiresAt: now },
      { ...base, tokenHash: "h3", expiresAt: now, usedAt: now, usedBy: { name: "Nino", phone: "+995" } },
      { ...base, tokenHash: "h4", expiresAt: now, usedAt: now, usedBy: { name: null, phone: "+995" } },
    ]);
    const rows = await listInvites();
    expect(rows.map((row) => [row.id, row.status, row.branch, row.usedBy])).toEqual([
      ["h1", "open", "Vake", null],
      ["h2", "expired", "", null],
      ["h3", "used", "", "Nino"],
      ["h4", "used", "", "+995"],
    ]);
  });

  it("revokes only an unused link, and ignores a malformed id", async () => {
    await revokeInvite(hash);
    expect(prisma.agentInvite.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: hash, usedAt: null } });
    await revokeInvite("nope");
    expect(prisma.agentInvite.deleteMany).toHaveBeenCalledOnce();
  });

  it("lists every branch", async () => {
    prisma.branch.findMany.mockResolvedValue([{ id: "b1", name: "Vake" }]);
    expect(await listInviteBranches()).toEqual([{ id: "b1", name: "Vake" }]);
  });

  it.each([
    [null, "missing", ""],
    [{ usedAt: null, expiresAt: new Date(now.getTime() + day), branch: { name: "Vake" } }, "open", "Vake"],
    [{ usedAt: now, expiresAt: new Date(now.getTime() + day), branch: null }, "used", ""],
    [{ usedAt: null, expiresAt: now, branch: null }, "expired", ""],
  ])("checks a link without using it (%o)", async (row, status, branch) => {
    prisma.agentInvite.findUnique.mockResolvedValue(row);
    expect(await checkInvite(token)).toEqual({ status, branch });
    expect(prisma.agentInvite.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hash });
  });

  it("calls a malformed token missing without a query", async () => {
    expect(await checkInvite("short")).toEqual({ status: "missing", branch: "" });
    expect(prisma.agentInvite.findUnique).not.toHaveBeenCalled();
  });
});

describe("acceptInvite", () => {
  const open = () => {
    prisma.agentInvite.findUnique.mockResolvedValue({ branchId: "b1" });
    prisma.agentInvite.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
  };

  it("uses the link and makes the user a broker in the link's branch", async () => {
    open();
    expect(await acceptInvite("u1", token)).toBe("accepted");
    expect(prisma.agentInvite.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now, usedById: "u1" },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1", role: "USER" }, data: { role: "AGENT" } });
    expect(prisma.agent.upsert).toHaveBeenCalledWith({ where: { userId: "u1" }, create: { userId: "u1", branchId: "b1" }, update: { branchId: "b1" } });
  });

  it("keeps a returning broker's branch when the link names none", async () => {
    open();
    prisma.agentInvite.findUnique.mockResolvedValue({ branchId: null });
    await acceptInvite("u1", token);
    expect(prisma.agent.upsert.mock.calls[0][0].update).toEqual({ branchId: undefined });
  });

  it("refuses a malformed, unknown, used or expired link", async () => {
    expect(await acceptInvite("u1", "short")).toBe("invalid");
    prisma.agentInvite.findUnique.mockResolvedValue(null);
    expect(await acceptInvite("u1", token)).toBe("invalid");
    prisma.agentInvite.findUnique.mockResolvedValue({ branchId: null });
    prisma.agentInvite.updateMany.mockResolvedValue({ count: 0 });
    expect(await acceptInvite("u1", token)).toBe("invalid");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("rolls back for someone who is already a broker or admin", async () => {
    open();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    expect(await acceptInvite("u1", token)).toBe("already");
    expect(prisma.agent.upsert).not.toHaveBeenCalled();
  });

  it("passes other failures on", async () => {
    prisma.$transaction.mockRejectedValue(new Error("down"));
    await expect(acceptInvite("u1", token)).rejects.toThrow("down");
  });
});

describe("brokers", () => {
  it("lists everyone with the broker role", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", name: "Nino", phone: "+995", agent: { branch: { name: "Vake" } } },
      { id: "u2", name: null, phone: null, agent: null },
    ]);
    expect(await listCurrentBrokers()).toEqual([
      { userId: "u1", name: "Nino", phone: "+995", branch: "Vake" },
      { userId: "u2", name: "", phone: "", branch: "" },
    ]);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: "AGENT" });
  });

  it("removes the role and hands the chats back in one transaction", async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    await removeBroker("u1");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1", role: "AGENT" }, data: { role: "USER" } });
    expect(roles.handBackChats).toHaveBeenCalledWith(prisma, "u1");
  });

  it("leaves admins, strangers and malformed ids alone", async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await removeBroker("u1");
    await removeBroker("bad id!");
    expect(prisma.user.updateMany).toHaveBeenCalledOnce();
    expect(roles.handBackChats).not.toHaveBeenCalled();
  });

  it("reads a broker's profile", async () => {
    prisma.agent.findFirst.mockResolvedValueOnce({ photoUrl: "p.jpg", bio: "Hi", branch: { name: "Vake" } }).mockResolvedValueOnce({ photoUrl: null, bio: null, branch: null }).mockResolvedValueOnce(null);
    expect(await getBrokerProfile("a1")).toEqual({ photoUrl: "p.jpg", bio: "Hi", branch: "Vake" });
    expect(await getBrokerProfile("a1")).toEqual({ photoUrl: null, bio: null, branch: "" });
    expect(await getBrokerProfile("a1")).toBeNull();
    expect(await getBrokerProfile("bad id!")).toBeNull();
    expect(prisma.agent.findFirst).toHaveBeenCalledTimes(3);
  });

  it("saves the bio, clearing an empty one, and a new photo", async () => {
    await saveBrokerProfile("a1", "", "p.jpg");
    expect(prisma.agent.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { bio: null, photoUrl: "p.jpg" } });
    await saveBrokerProfile("a1", "Hi");
    expect(prisma.agent.update).toHaveBeenLastCalledWith({ where: { id: "a1" }, data: { bio: "Hi", photoUrl: undefined } });
  });
});

describe("requestVerification", () => {
  const owned = (name: string | null) => prisma.listing.findFirst.mockResolvedValue({ deal: "RENT", owner: { name, phone: "+995555123456" } });

  it("files a lead for the owner's listing", async () => {
    owned("Nino");
    expect(await requestVerification("u1", 7)).toBe(true);
    expect(prisma.listing.findFirst.mock.calls[0][0].where).toEqual({ id: 7, ownerId: "u1", status: "ACTIVE", verified: false, agentId: null });
    expect(prisma.lead.findFirst.mock.calls[0][0].where).toEqual({ note: "Verify listing 7", createdAt: { gte: new Date(now.getTime() - 7 * day) } });
    expect(prisma.lead.create).toHaveBeenCalledWith({ data: { name: "Nino", phone: "+995555123456", deal: "RENT", note: "Verify listing 7" } });
  });

  it("names an owner without a name by their phone", async () => {
    owned(null);
    await requestVerification("u1", 7);
    expect(prisma.lead.create.mock.calls[0][0].data.name).toBe("+995555123456");
  });

  it("files one lead per listing in 7 days", async () => {
    owned("Nino");
    prisma.lead.findFirst.mockResolvedValue({ id: "l1" });
    expect(await requestVerification("u1", 7)).toBe(true);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("refuses someone else's, verified, brokered or phoneless listing", async () => {
    prisma.listing.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ deal: "SALE", owner: { name: "Nino", phone: null } });
    expect(await requestVerification("u1", 7)).toBe(false);
    expect(await requestVerification("u1", 7)).toBe(false);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });
});
