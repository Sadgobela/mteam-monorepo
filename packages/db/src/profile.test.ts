import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  conversation: { findFirst: vi.fn() },
  codeRequestLimit: { updateMany: vi.fn(), createMany: vi.fn() },
}));

vi.mock("./client", () => ({ db: () => prisma }));

import { claimAvatarUpload, completeOnboarding, getChatPartner, getProfile, getPublicPerson, setAvatar, updateProfile } from "./index";

const now = new Date("2026-11-16T10:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now });
});

describe("own profile", () => {
  it("reads only what the profile page shows", async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ name: "Nino" });
    expect(await getProfile("u1")).toEqual({ name: "Nino" });
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "u1" }, select: { name: true, avatarUrl: true, intent: true, createdAt: true } });
  });

  it("finishes onboarding with the answers, the terms and the time, never a role", async () => {
    await completeOnboarding("u1", { name: "Nino", intent: "BROKER" });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Nino", intent: "BROKER", onboardedAt: now, termsAcceptedAt: now } });
  });

  it("saves a new name, intent and photo", async () => {
    await updateProfile("u1", { name: "Nino B", intent: "OWNER" });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Nino B", intent: "OWNER" } });
    await setAvatar("u1", "https://cdn/a.webp");
    expect(prisma.user.update).toHaveBeenLastCalledWith({ where: { id: "u1" }, data: { avatarUrl: "https://cdn/a.webp" } });
  });
});

describe("what others see", () => {
  it("gives a seller's name and photo, and nothing for a malformed id", async () => {
    prisma.user.findUnique.mockResolvedValue({ name: "Nino", avatarUrl: null });
    expect(await getPublicPerson("u2")).toEqual({ name: "Nino", avatarUrl: null });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: "u2" }, select: { name: true, avatarUrl: true } });
    expect(await getPublicPerson("../x")).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("gives the other side of a chat, only to someone in it", async () => {
    const buyer = { name: "Buyer", avatarUrl: null };
    const seller = { name: "Seller", avatarUrl: "https://cdn/s.webp" };
    prisma.conversation.findFirst.mockResolvedValue({ buyerId: "u1", buyer, seller });
    expect(await getChatPartner("u1", "c1")).toBe(seller);
    expect(prisma.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: "c1", OR: [{ buyerId: "u1" }, { sellerId: "u1" }] });
    expect(await getChatPartner("u2", "c1")).toBe(buyer);
    prisma.conversation.findFirst.mockResolvedValue(null);
    expect(await getChatPartner("u3", "c1")).toBeNull();
    expect(await getChatPartner("u1", "bad id")).toBeNull();
    expect(prisma.conversation.findFirst).toHaveBeenCalledTimes(3);
  });
});

describe("photo upload limit", () => {
  const { updateMany, createMany } = prisma.codeRequestLimit;

  it("opens a new window when the last one is over an hour old", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await claimAvatarUpload("u1")).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { ipHash: "avatar:u1", windowStart: { lte: new Date(now.getTime() - 3_600_000) } },
      data: { windowStart: now, count: 1 },
    });
  });

  it("counts within the window, then starts one for a first upload, and refuses past ten", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    expect(await claimAvatarUpload("u1")).toBe(true);
    expect(updateMany).toHaveBeenLastCalledWith({ where: { ipHash: "avatar:u1", count: { lt: 10 } }, data: { count: { increment: 1 } } });

    updateMany.mockResolvedValue({ count: 0 });
    createMany.mockResolvedValueOnce({ count: 1 });
    expect(await claimAvatarUpload("u1")).toBe(true);
    expect(createMany).toHaveBeenCalledWith({ data: [{ ipHash: "avatar:u1", windowStart: now, count: 1 }], skipDuplicates: true });

    createMany.mockResolvedValueOnce({ count: 0 });
    expect(await claimAvatarUpload("u1")).toBe(false);
  });
});
