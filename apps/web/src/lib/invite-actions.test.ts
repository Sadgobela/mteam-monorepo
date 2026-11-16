// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  claimInviteCheck: vi.fn(),
  createInvite: vi.fn(),
  parseListingId: vi.fn(),
  removeBroker: vi.fn(),
  requestVerification: vi.fn(),
  revokeInvite: vi.fn(),
  saveBrokerProfile: vi.fn(),
}));
const session = vi.hoisted(() => ({ currentUser: vi.fn(), clientIp: vi.fn(async () => "1.2.3.4"), signInHere: vi.fn(async () => "/en/login?next=%2Fen") }));
const photos = vi.hoisted(() => ({ readPhotos: vi.fn(), uploadPhoto: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@mteam/db", () => db);
vi.mock("./session", () => session);
vi.mock("./photos", () => photos);
vi.mock("next/cache", () => cache);
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import {
  acceptInviteAction,
  createInviteAction,
  removeBrokerAction,
  requestVerifyAction,
  revokeInviteAction,
  saveBrokerProfileAction,
} from "./invite-actions";

const admin = { id: "u1", role: "ADMIN", agent: { id: "a1" } };
const broker = { id: "u2", role: "AGENT", agent: { id: "a2" } };
const owner = { id: "u3", role: "USER", agent: null };
const token = "t".repeat(43);
const form = (fields: Record<string, string | File>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("admin invite actions", () => {
  it("creates a link for a branch and returns it once", async () => {
    session.currentUser.mockResolvedValue(admin);
    db.createInvite.mockResolvedValue(token);
    expect(await createInviteAction({}, form({ locale: "ka", branchId: "b1" }))).toEqual({ link: `http://localhost:3111/ka/invite/${token}` });
    expect(db.createInvite).toHaveBeenCalledWith("u1", "b1");
    expect(cache.revalidatePath).toHaveBeenCalled();
  });

  it("creates a link without a branch, and drops a malformed one", async () => {
    session.currentUser.mockResolvedValue(admin);
    db.createInvite.mockResolvedValue(token);
    await createInviteAction({}, form({ locale: "en", branchId: "" }));
    await createInviteAction({}, form({ locale: "en", branchId: "bad id!" }));
    await createInviteAction({}, form({ locale: "en" }));
    expect(db.createInvite.mock.calls.map((call) => call[1])).toEqual([null, null, null]);
  });

  it("says so when the link cannot be made", async () => {
    session.currentUser.mockResolvedValue(admin);
    db.createInvite.mockRejectedValue(new Error("down"));
    expect(await createInviteAction({}, form({ locale: "en" }))).toEqual({ failed: true });
  });

  it("revokes a link and removes a broker", async () => {
    session.currentUser.mockResolvedValue(admin);
    await revokeInviteAction(form({ id: "h1" }));
    await removeBrokerAction(form({ userId: "u2" }));
    expect(db.revokeInvite).toHaveBeenCalledWith("h1");
    expect(db.removeBroker).toHaveBeenCalledWith("u2");
  });

  it.each([null, broker, owner])("is a 404 for anyone but an admin (%o)", async (user) => {
    session.currentUser.mockResolvedValue(user);
    await expect(createInviteAction({}, form({}))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(revokeInviteAction(form({ id: "h1" }))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(removeBrokerAction(form({ userId: "u2" }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.createInvite).not.toHaveBeenCalled();
    expect(db.revokeInvite).not.toHaveBeenCalled();
    expect(db.removeBroker).not.toHaveBeenCalled();
  });
});

describe("acceptInviteAction", () => {
  it("makes the user a broker and opens their broker profile", async () => {
    session.currentUser.mockResolvedValue(owner);
    db.claimInviteCheck.mockResolvedValue(true);
    db.acceptInvite.mockResolvedValue("accepted");
    await expect(acceptInviteAction(form({ locale: "en", token }))).rejects.toThrow("REDIRECT /en/account/broker");
    expect(db.claimInviteCheck).toHaveBeenCalledWith("1.2.3.4");
    expect(db.acceptInvite).toHaveBeenCalledWith("u3", token);
  });

  it("goes back to the invite page, which says why, when the link does not work", async () => {
    session.currentUser.mockResolvedValue(owner);
    db.claimInviteCheck.mockResolvedValue(true);
    db.acceptInvite.mockResolvedValue("invalid");
    await expect(acceptInviteAction(form({ locale: "en", token }))).rejects.toThrow(`REDIRECT /en/invite/${token}`);
  });

  it("does not check the link past the limit", async () => {
    session.currentUser.mockResolvedValue(owner);
    db.claimInviteCheck.mockResolvedValue(false);
    await expect(acceptInviteAction(form({ locale: "en", token: "a b" }))).rejects.toThrow("REDIRECT /en/invite/a%20b");
    expect(db.acceptInvite).not.toHaveBeenCalled();
  });

  it("sends a visitor to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(acceptInviteAction(form({ locale: "en" }))).rejects.toThrow("REDIRECT /en/login?next=%2Fen");
    expect(db.claimInviteCheck).not.toHaveBeenCalled();
  });
});

describe("saveBrokerProfileAction", () => {
  const photo = new File(["x"], "me.jpg");

  it("saves the bio without touching the photo when none is chosen", async () => {
    session.currentUser.mockResolvedValue(broker);
    expect(await saveBrokerProfileAction({}, form({ locale: "en", bio: "  Ten years in Vake. ", photo: new File([], "") }))).toEqual({ saved: true });
    expect(db.saveBrokerProfile).toHaveBeenCalledWith("a2", "Ten years in Vake.", undefined);
    expect(photos.readPhotos).not.toHaveBeenCalled();
  });

  it("uploads a new photo", async () => {
    session.currentUser.mockResolvedValue(broker);
    photos.readPhotos.mockResolvedValue([{ bytes: new Uint8Array(), type: "image/jpeg", ext: "jpg" }]);
    photos.uploadPhoto.mockResolvedValue("https://img.example/me.jpg");
    expect(await saveBrokerProfileAction({}, form({ locale: "en", photo }))).toEqual({ saved: true });
    expect(photos.readPhotos).toHaveBeenCalledWith([expect.any(File)]);
    expect(db.saveBrokerProfile).toHaveBeenCalledWith("a2", "", "https://img.example/me.jpg");
  });

  it("refuses a file that is not a photo, and a bio that is too long", async () => {
    session.currentUser.mockResolvedValue(broker);
    photos.readPhotos.mockResolvedValue(null);
    expect(await saveBrokerProfileAction({}, form({ locale: "en", photo }))).toEqual({ badPhoto: true });
    expect(await saveBrokerProfileAction({}, form({ locale: "en", bio: "x".repeat(601) }))).toEqual({ badBio: true });
    expect(await saveBrokerProfileAction({}, form({ locale: "en", bio: photo }))).toEqual({ badBio: true });
    expect(db.saveBrokerProfile).not.toHaveBeenCalled();
  });

  it("says so when saving fails", async () => {
    session.currentUser.mockResolvedValue(broker);
    db.saveBrokerProfile.mockRejectedValue(new Error("down"));
    expect(await saveBrokerProfileAction({}, form({ locale: "en", bio: "Hi" }))).toEqual({ failed: true });
  });

  it("is for brokers only", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(saveBrokerProfileAction({}, form({ locale: "en" }))).rejects.toThrow("REDIRECT");
    for (const user of [owner, admin, { ...broker, agent: null }]) {
      session.currentUser.mockResolvedValue(user);
      await expect(saveBrokerProfileAction({}, form({ locale: "en" }))).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(db.saveBrokerProfile).not.toHaveBeenCalled();
  });
});

describe("requestVerifyAction", () => {
  it("files the owner's request", async () => {
    session.currentUser.mockResolvedValue(owner);
    db.parseListingId.mockReturnValue(7);
    db.requestVerification.mockResolvedValue(true);
    expect(await requestVerifyAction({}, form({ locale: "en", listingId: "7" }))).toEqual({ sent: true });
    expect(db.requestVerification).toHaveBeenCalledWith("u3", 7);
  });

  it("fails for a bad id, a listing that does not qualify, or an error", async () => {
    session.currentUser.mockResolvedValue(owner);
    db.parseListingId.mockReturnValueOnce(null).mockReturnValue(7);
    expect(await requestVerifyAction({}, form({ locale: "en", listingId: "x" }))).toEqual({ failed: true });
    db.requestVerification.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("down"));
    expect(await requestVerifyAction({}, form({ locale: "en", listingId: "7" }))).toEqual({ failed: true });
    expect(await requestVerifyAction({}, form({ locale: "en", listingId: "7" }))).toEqual({ failed: true });
  });

  it("sends a visitor to sign in", async () => {
    session.currentUser.mockResolvedValue(null);
    await expect(requestVerifyAction({}, form({ locale: "en", listingId: "7" }))).rejects.toThrow("REDIRECT");
  });
});
